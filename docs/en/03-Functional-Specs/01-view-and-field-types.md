# View Types and Field Controls

> This document defines the UI representations and data input specifications supported by Zenku, ensuring the AI can generate interfaces that align with business logic.

---

## 1. View Types

Zenku provides various canvas types to present data across different dimensions:

| Type | Use Case | Key Configuration Parameters |
| :--- | :--- | :--- |
| `table` | Basic CRUD list. | `columns`, `actions` |
| `master-detail` | Master-detail management (e.g., Orders + Items). | `detail_views` (array) |
| `dashboard` | Data visualization and statistics. | `widgets` (stat, bar, line, pie) |
| `kanban` | Process management and status tracking. | `group_field`, `title_field` |
| `calendar` | Time-based scheduling. | `date_field`, `title_field` |
| `timeline` | Event evolution history. | `date_field`, `icon_field` |
| `gallery` | Card-based image display. | `image_field`, `title_field` |
| `tree` | Hierarchical structures (e.g., org charts). | `parent_field` |
| `gantt` | Project progress and scheduling. | `start_field`, `end_field`, `progress` |
| `form-only` | Pure form mode for specific workflows. | `form.fields` |

---

## 2. Field Types and Controls

The system supports a rich set of controls, specified via `FieldDef.type`:

### Basic Inputs
*   `text`, `number`, `textarea`: Basic text, numbers, and long text.
*   `boolean`: Toggle switch.
*   `date`, `datetime`, `time`: Date and time pickers.

### Advanced Controls
*   `select`, `multiselect`: Dropdown menus (supports static `options` or dynamic `source`).
*   `currency`: Currency input with automatic formatting.
*   `richtext`, `markdown`: Rich text and Markdown editors (Tiptap / CodeMirror).
*   `phone`, `email`, `url`: Input boxes with basic format validation.
*   `rating`, `progress`, `color`: Star ratings, progress bars, and color pickers.

---

## 3. Special Field Configurations

### Relation Fields (`relation`)
Dedicated to selecting records from other tables (foreign key mapping):
*   `table`: The target table for the relation.
*   `value_field`: The value stored in the DB (usually `id`).
*   `display_field`: The field displayed in the UI (e.g., `name`).
*   `display_format`: Supports composite display, such as `{name} ({phone})`.

### Auto-Number (`auto_number`)
Used to generate unique codes (e.g., order numbers):
*   `prefix`: The prefix (e.g., `ORD-`).
*   `date_format`: Date segment (e.g., `YYYYMMDD`).
*   `padding`: Length of the sequence number.
*   `reset`: Reset cycle (daily, monthly, yearly, or never).

### Computed Fields (`computed`)
Fields calculated in real-time on the frontend:
*   `formula`: Calculation formula (e.g., `quantity * price`).
*   `dependencies`: List of dependent fields; re-calculates automatically when dependencies change.
