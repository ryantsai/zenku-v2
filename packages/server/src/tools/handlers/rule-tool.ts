import { ZenkuTool } from '../types';
import { runLogicAgent } from '../../agents/logic-agent';

export const manageRulesTool: ZenkuTool = {
  definition: {
    name: 'manage_rules',
    description: `Create or modify business rules (automation flows, validation).

Rules execute automatically before/after CRUD operations:
- before_insert / before_update / before_delete: Can intercept, modify data, validate
- after_insert / after_update / after_delete: Can trigger side effects (webhooks, create records)

Action types:
- set_field: Set field value (value can be formula like "total * 0.9")
- validate: Validation rule (reject operation if condition met, return message)
- create_record: Insert new record in another table
- update_record: Update existing record in another table, suitable for 1:1 relationships
- update_related_records: Batch update target table via intermediate detail table (suitable for 1:many, e.g., purchase_order → items → inventory)
- webhook: Call external URL
- notify: Record notification

Condition operators: eq, neq, gt, lt, gte, lte, contains, changed, was_eq, was_neq
- was_eq: Old value equals value before trigger (good for "status changed from X" in after_update rules)
- was_neq: Old value not equals value (e.g., trigger only if previous status was not draft)

Condition field supports FK paths (cross-table conditions):
- To check customer tier in order_items rule, use condition.field "order_id.customer_id.tier"
- Engine automatically traverses FK chain: order_items.order_id → orders → orders.customer_id → customers → customers.tier`,
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['create_rule', 'update_rule', 'delete_rule', 'list_rules'],
        },
        rule_id: { type: 'string', description: 'Rule ID for update_rule/delete_rule' },
        table_name: { type: 'string', description: 'Filter specific table in list_rules' },
        rule: {
          type: 'object',
          description: 'Rule definition (required for create_rule/update_rule)',
          properties: {
            name: { type: 'string', description: 'Rule name' },
            description: { type: 'string' },
            table_name: { type: 'string', description: 'Table this rule applies to' },
            trigger_type: {
              type: 'string',
              enum: ['before_insert', 'after_insert', 'before_update', 'after_update', 'before_delete', 'after_delete', 'manual'],
              description: 'manual = triggered by a custom ViewAction button (trigger_rule behavior)',
            },
            condition: {
              type: 'object',
              description: 'Trigger condition (not set = always trigger). Field supports FK paths: e.g., for order_items to check customer tier, use "order_id.customer_id.tier" (traverses FK chain)',
              properties: {
                field: {
                  type: 'string',
                  description: 'Field name. Can use FK dot path to cross tables, e.g., "order_id.customer_id.tier"',
                },
                operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'changed', 'was_eq', 'was_neq'] },
                value: {},
              },
              required: ['field', 'operator'],
            },
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['set_field', 'validate', 'create_record', 'update_record', 'update_related_records', 'webhook', 'notify'] },
                  field: { type: 'string', description: 'Target field for set_field' },
                  value: { type: 'string', description: 'Value or formula for set_field' },
                  message: { type: 'string', description: 'Error message for validate' },
                  target_table: { type: 'string', description: 'Target table for create/update record actions' },
                  record_data: { type: 'object', description: 'Field mapping (field_name -> expression). In update_related_records, use detail field names directly, and prefix target table existing values with __old_, e.g., "__old_quantity + quantity"' },
                  where: { type: 'object', description: 'update_record / update_related_records: Condition to locate target records. Key is target table field, value is source expression. Example: { product_id: "product_id" }' },
                  via_table: { type: 'string', description: 'Intermediate detail table for update_related_records (e.g., purchase_order_items)' },
                  via_foreign_key: { type: 'string', description: 'FK field in detail table pointing to source table (e.g., purchase_order_id)' },
                  url: { type: 'string', description: 'webhook URL' },
                  method: { type: 'string', description: 'webhook HTTP method, default POST' },
                  text: { type: 'string', description: 'Notification text' },
                },
                required: ['type'],
              },
            },
            priority: { type: 'number', description: 'Priority (smaller number executes first), default 0' },
          },
          required: ['name', 'table_name', 'trigger_type', 'actions'],
        },
      },
      required: ['action'],
    },
  },
  execute: async (input: any, userMessage?: string) => {
    return runLogicAgent(input, userMessage!);
  },
};
