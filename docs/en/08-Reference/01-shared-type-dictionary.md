# Core Type Dictionary

> This document summarizes the core data structures defined in `@zenku/shared`, which define the communication protocols between the AI, backend, and frontend.

---

## 1. Field Definition (`FieldDef`)
Defines the behavior of a column in a data table within frontend forms and backend storage.

```typescript
interface FieldDef {
  key: string;              // Database column name
  label: string;            // UI display label
  type: FieldType;          // text, number, relation, computed, auto_number...
  required?: boolean;       // Whether it is mandatory
  relation?: {              // Relation configuration
    table: string;
    display_field: string;
    value_field: string;
  };
  computed?: {              // Calculation formula
    formula: string;
    dependencies: string[];
  };
  appearance?: AppearanceRule[]; // Conditional rendering rules
}
```

---

## 2. View Definition (`ViewDefinition`)
Defines a complete interface page, including lists, forms, actions, and sub-tables.

```typescript
interface ViewDefinition {
  id: string;               // Unique View ID
  name: string;             // Display name
  type: ViewType;           // table, kanban, dashboard, master-detail...
  table_name: string;       // Source table name
  columns: ColumnDef[];     // Columns to display in list view
  form: {                   // Form configuration
    columns: number;        // Number of columns in layout (1-4)
    fields: FieldDef[];
  };
  actions: ViewAction[];    // Functional buttons
  detail_views?: DetailView[]; // Sub-tables in Master-Detail mode
}
```

---

## 3. Appearance Rule (`AppearanceRule`)
Rules used by the frontend real-time evaluation engine.

```typescript
interface AppearanceRule {
  when: {
    field: string;          // Dependent field
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: any;             // Value to compare against
  };
  apply: {
    visibility?: 'visible' | 'hidden';
    enabled?: boolean;      // Read-only or enabled
    text_color?: string;    // CSS color
    font_weight?: 'bold' | 'normal';
  };
}
```

---

## 4. Glossary

| Term (EN) | Term (ZH-TW) | Description |
| :--- | :--- | :--- |
| **Orchestrator** | 調度器 | The core responsible for conversation and Agent collaboration. |
| **Business Rules** | 商業規則 | Automation logic triggered on the backend. |
| **Design Journal** | 設計日誌 | A chronological record of all system structure changes, used for Undo. |
| **View** | 視圖 | A UI display interface mapped from a data table. |
| **Relation Field** | 關聯欄位 | A Foreign Key field pointing to another table. |
| **Master Reference** | 穿透引用 (`$master.key`) | Syntax to access master table data within a sub-table (detail view). |
