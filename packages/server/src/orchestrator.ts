import Anthropic from '@anthropic-ai/sdk';
import { getAllSchemas, getAllViews } from './db';
import { runSchemaAgent } from './agents/schema-agent';
import { runUiAgent } from './agents/ui-agent';
import { runQueryAgent } from './agents/query-agent';
import type { ViewDefinition } from './types';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'manage_schema',
    description: '建立或修改資料表結構。當使用者想要建立新的資料類型或修改現有資料結構時使用。建立新表後，必須同時呼叫 manage_ui 建立對應介面。',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['create_table', 'alter_table', 'describe_tables'],
          description: '操作類型',
        },
        table_name: {
          type: 'string',
          description: '表名（英文小寫，底線分隔）',
        },
        columns: {
          type: 'array',
          description: 'create_table 時需要提供的欄位定義',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: {
                type: 'string',
                enum: ['TEXT', 'INTEGER', 'REAL', 'BOOLEAN', 'DATE', 'DATETIME'],
              },
              required: { type: 'boolean' },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: '如果是 enum 性質的欄位，列出允許的值',
              },
            },
            required: ['name', 'type'],
          },
        },
        changes: {
          type: 'array',
          description: 'alter_table 時需要提供的修改項目',
          items: {
            type: 'object',
            properties: {
              operation: { type: 'string', enum: ['add_column'] },
              column: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: ['TEXT', 'INTEGER', 'REAL', 'BOOLEAN', 'DATE', 'DATETIME'],
                  },
                  required: { type: 'boolean' },
                  options: { type: 'array', items: { type: 'string' } },
                },
                required: ['name', 'type'],
              },
            },
            required: ['operation', 'column'],
          },
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_ui',
    description: '建立或更新使用者介面（列表 + 表單）。在 manage_schema 建表或改表後呼叫，讓介面與資料結構保持同步。',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['create_view', 'update_view'],
        },
        view: {
          type: 'object',
          description: 'View 定義',
          properties: {
            id: { type: 'string', description: '唯一 ID，通常等於 table_name' },
            name: { type: 'string', description: '顯示名稱，如「客戶管理」' },
            table_name: { type: 'string' },
            type: { type: 'string', enum: ['table'] },
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  label: { type: 'string' },
                  type: { type: 'string', enum: ['text', 'number', 'select', 'boolean', 'date'] },
                  sortable: { type: 'boolean' },
                },
                required: ['key', 'label', 'type'],
              },
            },
            form: {
              type: 'object',
              properties: {
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      label: { type: 'string' },
                      type: {
                        type: 'string',
                        enum: ['text', 'number', 'select', 'boolean', 'date', 'textarea'],
                      },
                      required: { type: 'boolean' },
                      options: { type: 'array', items: { type: 'string' } },
                      placeholder: { type: 'string' },
                    },
                    required: ['key', 'label', 'type'],
                  },
                },
              },
              required: ['fields'],
            },
            actions: {
              type: 'array',
              items: { type: 'string', enum: ['create', 'edit', 'delete'] },
            },
          },
          required: ['id', 'name', 'table_name', 'type', 'columns', 'form', 'actions'],
        },
      },
      required: ['action', 'view'],
    },
  },
  {
    name: 'query_data',
    description: '查詢資料、回答統計問題。只能執行 SELECT 查詢。',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'SELECT SQL 語句',
        },
        explanation: {
          type: 'string',
          description: '這個查詢在做什麼',
        },
      },
      required: ['sql', 'explanation'],
    },
  },
];

function buildSystemPrompt(): string {
  const schemas = getAllSchemas();
  const views = getAllViews();

  const schemaStr = Object.keys(schemas).length > 0
    ? Object.entries(schemas).map(([table, cols]) =>
        `表 ${table}：${cols.map(c => `${c.name}(${c.type})`).join(', ')}`
      ).join('\n')
    : '（目前沒有任何資料表）';

  const viewStr = views.length > 0
    ? views.map(v => `- ${v.name}（對應表：${v.table_name}）`).join('\n')
    : '（目前沒有任何介面）';

  return `你是 Zenku 的 Orchestrator。使用者透過對話描述需求，你負責建構應用。

你有以下工具：
- manage_schema：建立或修改資料表結構
- manage_ui：建立或更新使用者介面（列表＋表單）
- query_data：查詢資料、回答統計問題

重要規則：
1. 使用者要求建立新資料類型時：先呼叫 manage_schema（create_table），成功後必須立即呼叫 manage_ui（create_view）生成對應介面
2. 使用者要求修改資料結構時：先呼叫 manage_schema（alter_table），成功後呼叫 manage_ui（update_view）更新介面
3. 使用者詢問資料相關統計問題時：呼叫 query_data
4. 表名使用英文小寫＋底線，欄位名也是
5. 所有回應使用繁體中文
6. 每次操作後，簡潔告知使用者完成了什麼
7. View 的 id 與 table_name 保持一致

目前資料庫：
${schemaStr}

目前介面：
${viewStr}`;
}

export async function* chat(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): AsyncGenerator<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ];

  let continueLoop = true;
  const currentMessages = [...messages];

  while (continueLoop) {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages: currentMessages,
    });

    // 先處理文字內容
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        yield JSON.stringify({ type: 'text', content: block.text }) + '\n';
      }
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const toolName = block.name;
        const toolInput = block.input as Record<string, unknown>;

        yield JSON.stringify({ type: 'tool_start', tool: toolName }) + '\n';

        let result;
        try {
          if (toolName === 'manage_schema') {
            result = runSchemaAgent(toolInput as unknown as Parameters<typeof runSchemaAgent>[0], userMessage);
          } else if (toolName === 'manage_ui') {
            result = runUiAgent(
              toolInput as { action: 'create_view' | 'update_view'; view: ViewDefinition },
              userMessage
            );
          } else if (toolName === 'query_data') {
            result = runQueryAgent(toolInput as { sql: string; explanation: string });
          } else {
            result = { success: false, message: `未知工具：${toolName}` };
          }
        } catch (err) {
          result = { success: false, message: String(err) };
        }

        yield JSON.stringify({ type: 'tool_result', tool: toolName, result }) + '\n';

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages.push({ role: 'assistant', content: response.content });
      currentMessages.push({ role: 'user', content: toolResults });
    } else {
      continueLoop = false;
    }
  }

  yield JSON.stringify({ type: 'done' }) + '\n';
}
