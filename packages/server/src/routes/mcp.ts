import { Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { requireApiKey, expandScopes } from '../middleware/api-key-auth';
import { ALL_TOOLS, dispatchTool } from '../tools/registry';
import { buildDynamicContext } from '../orchestrator';
import { buildDashboardInstructions } from '../dashboard-instructions';
import type { ToolDefinition } from '../ai';

const router = Router();

const READ_TOOLS  = new Set(['query_data', 'get_table_schema', 'get_integration_guide']);
const WRITE_TOOLS = new Set(['write_data']);
const ADMIN_TOOLS = new Set(['manage_schema', 'manage_ui', 'manage_rules', 'assess_impact', 'undo_action']);

function getToolsForScopes(scopes: string[]): ToolDefinition[] {
  const expanded = new Set(expandScopes(scopes));
  const allowed = new Set<string>();
  if (expanded.has('mcp:read'))  READ_TOOLS.forEach(t => allowed.add(t));
  if (expanded.has('mcp:write')) WRITE_TOOLS.forEach(t => allowed.add(t));
  if (expanded.has('mcp:admin')) ADMIN_TOOLS.forEach(t => allowed.add(t));
  return ALL_TOOLS.filter(t => allowed.has(t.definition.name)).map(t => t.definition);
}

function sanitizeSchemaForMcp(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const s = { ...schema };
  if (Array.isArray(s.enum) && s.type && s.type !== 'string') delete s.enum;
  if (s.properties) {
    s.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, sanitizeSchemaForMcp(v)])
    );
  }
  if (s.items) s.items = sanitizeSchemaForMcp(s.items);
  if (Array.isArray(s.oneOf)) s.oneOf = s.oneOf.map(sanitizeSchemaForMcp);
  if (Array.isArray(s.anyOf)) s.anyOf = s.anyOf.map(sanitizeSchemaForMcp);
  return s;
}

async function buildMcpInstructions(): Promise<string> {
  const dynamicContext = await buildDynamicContext();
  return `You are connected to a Zenku instance — a low-code application runtime.

## Tool usage rules
- Call manage_schema before manage_ui when creating or modifying data types.
- Never guess column names; call get_table_schema first if unsure.
- query_data is SELECT-only; use write_data for mutations.
- Destructive schema changes (drop_column, drop_table) require assess_impact first.
- When updating an existing view, always call manage_ui(get_view) first, then submit the COMPLETE modified definition with update_view. Never send a partial definition.

## Creating views (manage_ui)

**CRITICAL: Avoid undefined values in view definitions:**
- Never include properties with undefined/null values
- Every column.key and form.field.key MUST match actual database columns (verify with get_table_schema)
- relation type REQUIRES relation object with: table, value_field, display_field
- select type REQUIRES options array
- auto_number type REQUIRES auto_number object with prefix and/or date_format
- computed type REQUIRES computed object with formula, dependencies, and format
- form MUST have fields array (can be empty [])
- actions MUST be set (use [] for read-only, ["create","edit","delete"] for CRUD)

Every view MUST include an "actions" array:
- Standard CRUD: actions: ["create", "edit", "delete"]
- Read-only: actions: []
- With export: actions: ["create", "edit", "delete", "export"]

**Field key alignment (critical):** Every form field "key" and every column "key" in a view MUST exactly match the actual database column name returned by get_table_schema. A mismatch causes runtime errors when saving records. After calling manage_schema, always verify column names before passing them to manage_ui.

Field naming: use English lowercase_underscore for all table and field names.

form.columns controls the form layout width (integer 1–4):
- Set 2 for most forms with 5+ fields; 3 for 8+ fields.
- Always set this explicitly when form has 5+ fields.

## View creation workflow
1. Call get_table_schema to retrieve all columns and their types
2. Create view definition with:
   - id, name, table_name (from schema)
   - type: "table" (most common)
   - columns: list each database column (key MUST match schema)
   - form: { columns: 2, fields: [...] }
   - actions: ["create", "edit", "delete"]
3. Do NOT include optional properties if you won't set them (e.g., don't add "group" unless you'll set a value)

${buildDashboardInstructions()}

## Relation fields
- Schema: INTEGER + references: { table: 'other_table' }
- UI columns: type "relation", relation: { table, display_field }
- UI form: type "relation", relation: { table, value_field: "id", display_field }

## Conditional Appearance
- Use appearance[] in form.fields to conditionally hide, disable, or style fields based on other field values.
- In master-detail views, detail form appearance rules can reference the parent master record by prefixing the field with "$master." (e.g. "$master.status").

${dynamicContext}`;
}

router.post('/', requireApiKey('mcp:read'), async (req, res) => {
  const scopes  = req.apiKeyScopes ?? [];
  const tools   = getToolsForScopes(scopes);
  const allowedNames = new Set(tools.map(t => t.name));
  const instructions = await buildMcpInstructions();

  const server = new Server(
    { name: 'zenku', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: sanitizeSchemaForMcp(t.input_schema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!allowedNames.has(name)) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: `Tool "${name}" is not available for this API key scope.` }) }],
        isError: true,
      };
    }
    // Clean up undefined values from arguments
    const cleanArgs = args ? JSON.parse(JSON.stringify(args)) : {};
    const result = await dispatchTool(name, cleanArgs, '(MCP)');
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      isError: !result.success,
    };
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try {
    await transport.handleRequest(req as any, res as any, req.body);
  } finally {
    await server.close();
  }
});

router.get('/', requireApiKey('mcp:read'), async (req, res) => {
  const server = new Server({ name: 'zenku', version: '1.0.0' }, { capabilities: { tools: {} } });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try {
    await transport.handleRequest(req as any, res as any);
  } finally {
    await server.close();
  }
});

router.get('/info', (_req, res) => {
  res.json({
    name: 'zenku',
    protocol: 'MCP Streamable HTTP',
    endpoint: '/api/mcp',
    auth: 'Bearer zk_live_<key>  (Header: Authorization)',
    scopes: {
      'mcp:read':  ['query_data', 'get_table_schema'],
      'mcp:write': ['query_data', 'get_table_schema', 'write_data'],
      'mcp:admin': ['query_data', 'get_table_schema', 'write_data', 'manage_schema', 'manage_ui', 'manage_rules', 'assess_impact', 'undo_action'],
    },
  });
});

export default router;
