# 核心型別字典 (Shared Type Dictionary)

> 本文件摘要了 `@zenku/shared` 中定義的核心資料結構，這些型別定義了 AI、後端與前端之間的溝通協議。

---

## 1. 欄位定義 (`FieldDef`)
定義了資料表中的一個欄位在前端表單與後端存儲中的行為。

```typescript
interface FieldDef {
  key: string;              // 資料庫欄位名
  label: string;            // UI 顯示標籤
  type: FieldType;          // text, number, relation, computed, auto_number...
  required?: boolean;       // 是否必填
  relation?: {              // 關聯配置
    table: string;
    display_field: string;
    value_field: string;
  };
  computed?: {              // 計算公式
    formula: string;
    dependencies: string[];
  };
  appearance?: AppearanceRule[]; // 條件渲染規則
}
```

---

## 2. 視圖定義 (`ViewDefinition`)
定義了一個完整的介面頁面，包含列表、表單、動作與子表。

```typescript
interface ViewDefinition {
  id: string;               // 視圖唯一 ID
  name: string;             // 顯示名稱
  type: ViewType;           // table, kanban, dashboard, master-detail...
  table_name: string;       // 資料來源表
  columns: ColumnDef[];     // 列表顯示欄位
  form: {                   // 表單配置
    columns: number;        // 欄位排版數量 (1-4)
    fields: FieldDef[];
  };
  actions: ViewAction[];    // 功能按鈕
  detail_views?: DetailView[]; // Master-Detail 模式下的子表
}
```

---

## 3. 外觀規則 (`AppearanceRule`)
前端實時評估引擎使用的規則。

```typescript
interface AppearanceRule {
  when: {
    field: string;          // 依賴欄位
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: any;             // 比較值
  };
  apply: {
    visibility?: 'visible' | 'hidden';
    enabled?: boolean;      // 唯讀/啟用
    text_color?: string;    // CSS 顏色
    font_weight?: 'bold' | 'normal';
  };
}
```

---

## 4. 系統術語對照表 (Glossary)

| 中文術語 | 英文術語 | 說明 |
| :--- | :--- | :--- |
| 調度器 | Orchestrator | 負責對話與 Agent 協作的核心。 |
| 商業規則 | Business Rules | 後端觸發的自動化邏輯。 |
| 設計日誌 | Design Journal | 記錄所有系統結構變更的流水帳，用於 Undo。 |
| 視圖 | View | 由資料表映射出的 UI 展示介面。 |
| 關聯欄位 | Relation Field | 指向另一張表的 Foreign Key 欄位。 |
| 穿透引用 | $master.key | 在子表中存取主表資料的語法。 |
