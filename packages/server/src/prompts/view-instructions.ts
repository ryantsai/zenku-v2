export function buildViewInstructions(): string {
  return `## View Creation Rules

**CRITICAL: Avoid undefined values in view definitions:**
- Never include properties with undefined/null values.
- Every column.key and form.field.key MUST exactly match actual database column names (verify with get_table_schema). A mismatch causes runtime errors when saving records.
- relation type REQUIRES relation object with: table, value_field, display_field.
- select type REQUIRES options array (or source for dynamic select).
- auto_number type REQUIRES auto_number object with prefix and/or date_format.
- computed type REQUIRES computed object with formula, dependencies, and format.
- form MUST have fields array (can be empty []).
- actions MUST be set (use [] for read-only, ["create","edit","delete"] for CRUD, ["create","edit","delete","export"] to include export).
- Do NOT include optional properties unless you are setting a value (e.g., do not add "kanban" unless creating a kanban view).

## When to use master-detail view (type: "master-detail")
Suggest or generate a master-detail view when:
- The user asks to view a record's details, related items, or sub-items on a dedicated page (e.g. "order details with line items", "project with tasks", "customer with orders").
- There is a parent-child relationship between two tables (one-to-many via foreign key).
- The user asks for a "detail page", "record page", or "profile view".
- The record has many fields that do not fit comfortably in a table row.

In master-detail type, the main table view shows a list; clicking a row navigates to a dedicated detail page with the full form and any related child tables (detail_views).

## Computed Fields (e.g., "Subtotal = Quantity × Price")
1. manage_schema: field type REAL.
2. manage_ui form.fields: add computed: { formula: 'quantity * unit_price', dependencies: ['quantity', 'unit_price'], format: 'currency' }.
3. manage_ui columns: type 'currency' or 'number'.

## Form Layout
form.columns controls the form layout width (integer 1–4):
- 1: single-column, for very simple forms (< 5 fields).
- 2: default for 5+ fields.
- 3: use for 8+ fields.
- 4: use for showcase/demo views with many field types.
- Always set explicitly when form has 5+ fields.`;
}
