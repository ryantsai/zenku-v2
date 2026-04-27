# View Actions and Conditional UI

> View actions turn static data displays into interactive business processes, while conditional UI provides real-time guidance to users based on data states.

---

## 1. View Actions

Zenku supports mounting action buttons across various views (e.g., Tables, Kanbans, Forms).

### A. Built-in Actions
Basic CRUD operations:
*   `create`: Add new data (pops up a form or navigates to a creation page).
*   `edit`: Edit the selected record.
*   `delete`: Delete the record.
*   `export`: Export the currently filtered data to CSV.

### B. Custom Actions
Advanced actions defined by AI agents or administrators, featuring the following attributes:
*   **Context (`context`)**: Determines if the button appears in the "List Row (`list`)", "Record Page (`record`) ", or both.
*   **Variant (`variant`)**: Supports different button styles (e.g., `destructive` red buttons, `warning` orange buttons).

### C. Action Behaviors
The specific logic triggered upon clicking a button:
*   `set_field`: Directly modifies a field value of the record (e.g., a "Confirm Receipt" button).
*   `trigger_rule`: Triggers a specified "Manual Business Rule."
*   `webhook`: Calls an external API, passing the current record data.
*   `navigate`: Jumps to another view, automatically applying filter conditions.
*   `create_related`: Creates a record in a related table (e.g., generating an "Invoice" from an "Order" with one click).

---

## 2. Conditional Appearance Rules

Appearance rules allow the frontend to change UI styles in real-time based on current field values, **without server interaction**.

### Supported Effects (`apply`)
*   **Field Styling**: `text_color`, `bg_color`, `font_weight`.
*   **Component Control**: `hidden` (Hide field), `disabled` (Disable field).

### Evaluation Logic
*   **Trigger Conditions (`when`)**: Supports comparisons like `eq`, `neq`, `gt`, `lt`, etc.
*   **Composite Logic**: Supports `AND` / `OR` multi-condition combinations.
*   **Dynamic Variables**: Supports keywords like `TODAY` (e.g., if "Due Date" is less than `TODAY`, display the "Status" field in red).

---

## 3. Button Visibility and Availability

Custom actions can be finely controlled via `AppearanceCondition`:
*   **Visibility Condition (`visible_when`)**: The button only appears when conditions are met (e.g., the "Pay" button only shows for "Unpaid" orders).
*   **Enablement Condition (`enabled_when`)**: The button appears but is grayed out and unclickable (e.g., the "Ship" button is disabled when stock is insufficient).

---

## 4. Interaction Confirmation (Confirm Dialog)

To prevent accidental triggers of important operations (like deletion or batch updates), actions can be configured with confirmation dialogs:
*   `title`: Title (e.g., "Are you sure you want to close this case?").
*   `description`: Warning text (e.g., "This action is irreversible; please confirm data accuracy").
