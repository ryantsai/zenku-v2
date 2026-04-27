# AI Multi-Agent System Architecture

> Zenku is not a single large-model application, but a multi-agent collaborative system directed by a central Orchestrator.

---

## 1. The Orchestrator

`orchestrator.ts` is the brain of the system, responsible for receiving user messages and determining which specialized agents to call to complete tasks.

### Core Workflow:
1.  **Dynamic Context Injection (`buildDynamicContext`)**: Before each conversation, the Orchestrator extracts the current "table structure," "existing views," "business rules," and "design journals" from the database in real-time. This ensures that the AI always reasons based on the latest system state.
2.  **Tool Dispatch**: Maps the LLM's Tool Calls to specific Agent processors.
3.  **Observability**: Records Token consumption, latency, and tool execution success rates for each conversation turn via the `chat-logger`.

---

## 2. Specialized Agents

The system divides permissions and responsibilities among five virtual agents, each equipped with a specific toolbox:

| Agent | Responsibility | Key Tools |
| :--- | :--- | :--- |
| **Schema Agent** | Database structural modeling. | `manage_schema` (create/alter table) |
| **UI Agent** | Canvas design and interface rendering logic. | `manage_ui` (create/get view) |
| **Logic Agent** | Business automation and validation logic. | `manage_rules` (triggers/actions) |
| **Query Agent** | Read-only data querying and statistical analysis. | `query_data` (SELECT only) |
| **Test Agent** | Risk assessment for destructive changes. | `assess_impact` |

---

## 3. Prompt Engineering

The Orchestrator's System Prompt is composed of multiple highly modular instruction segments (found in `prompts/`), including:
*   **Visual Interface Guidelines**: How to choose between Kanban, Calendar, or Dashboard based on business scenarios.
*   **Field Control Guidelines**: When to use `auto_number` or `relation`.
*   **Security Principles**: Strict restrictions on agents executing unauthorized cross-table operations.

---

## 4. Roles and Permission Boundaries

The AI's "toolbox" is dynamically adjusted based on the current user's `UserRole`:
*   **Admin/Builder**: Has the complete design toolbox (including Schema, UI, Rules).
*   **User**: Can only use `query_data` and `write_data`, with no access to tools that modify system structures.

---

## 5. Cross-Agent Collaboration Example

When a user says: "I want to build an order system where order numbers are auto-generated, and inventory is deducted after shipping."

1.  **Schema Agent**: Creates `orders` and `inventory` tables.
2.  **UI Agent**: Creates an order list view and configures the `auto_number` field.
3.  **Logic Agent**: Creates an `after_update` rule that executes `update_related_records` to deduct inventory when `status` changes to "Shipped."
4.  **Orchestrator**: Coordinates the entire process and reports progress back to the user in the requested language.
