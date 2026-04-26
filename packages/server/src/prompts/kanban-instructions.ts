export function buildKanbanInstructions(): string {
  return `## Kanban View
manage_ui, type: 'kanban', set kanban: { group_field, title_field }.
- group_field should be a select type field with fixed options (e.g., status).
- Still require columns and form (used as list mode fallback).
- **CRITICAL — column values**: ALWAYS call get_table_schema first to get the exact option values stored for the group_field. The kanban columns array must use the exact stored DB values (e.g., "To Do", "In Progress", "Done"), never translated text (e.g., "待辦"). Using translated values causes all kanban columns to show zero cards.`;
}
