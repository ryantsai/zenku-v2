# Zenku PoC — Implementation Plan

> **目標：** 用最少程式碼跑通「對話 → 建表 → 生成 UI → 查詢」的完整迴圈。
> **Demo 故事線：** 使用者用三句話建出一個客戶管理應用。

---

## 技術棧

| 層 | 選擇 | 理由 |
|---|---|---|
| Frontend | React + TypeScript + Vite | 快、輕、生態成熟 |
| UI Library | shadcn/ui + Tailwind | Building Blocks 基底，不重造輪子 |
| Backend | Node.js + Express + TypeScript | 前後同語言，PoC 簡單 |
| DB | better-sqlite3 | 同步 API、零配置、單檔 |
| AI | Claude API (`@anthropic-ai/sdk`) | tool_use 做 Orchestrator 分派 |
| 通訊 | REST + SSE | SSE 做串流回應，避免 WebSocket 複雜度 |

---

## 目錄結構

```
zenku/
├── package.json              # monorepo root (npm workspaces)
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts              # Express 入口
│   │   │   ├── orchestrator.ts       # Orchestrator agent (Claude tool_use)
│   │   │   ├── agents/
│   │   │   │   ├── schema-agent.ts   # DDL 操作
│   │   │   │   ├── ui-agent.ts       # View 定義生成
│   │   │   │   └── query-agent.ts    # SELECT 查詢
│   │   │   ├── tools/
│   │   │   │   ├── db-tools.ts       # create_table, alter_table, query, etc.
│   │   │   │   └── view-tools.ts     # create_view, update_view
│   │   │   ├── db.ts                 # SQLite 連線 + 初始化
│   │   │   └── types.ts              # 共用型別
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── ChatPanel.tsx      # 對話框
│       │   │   ├── AppArea.tsx        # 動態應用區域
│       │   │   ├── Sidebar.tsx        # 選單
│       │   │   └── blocks/
│       │   │       ├── TableView.tsx  # 列表元件
│       │   │       └── FormView.tsx   # 表單元件
│       │   ├── hooks/
│       │   │   └── useChat.ts        # 對話狀態管理
│       │   └── types.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
```

---

## Phase 1：基礎骨架

### 1.1 專案初始化
- [ ] 建立 monorepo（npm workspaces）
- [ ] `packages/server`：Express + TypeScript + better-sqlite3
- [ ] `packages/web`：Vite + React + TypeScript + Tailwind + shadcn/ui
- [ ] 根目錄 dev script 同時啟動前後端

### 1.2 DB 層
- [ ] `db.ts`：初始化 SQLite，建立 `_zenku_views` 和 `_zenku_changes` 系統表

```sql
-- 存 view 定義
CREATE TABLE IF NOT EXISTS _zenku_views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  definition TEXT NOT NULL,  -- JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 存操作紀錄（簡化版 Design Journal）
CREATE TABLE IF NOT EXISTS _zenku_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,         -- JSON
  user_request TEXT
);
```

### 1.3 基礎 API
- [ ] `POST /api/chat` — 接收使用者訊息，回傳 SSE 串流
- [ ] `GET /api/views` — 取得所有 view 定義
- [ ] `GET /api/data/:table` — 取得某表資料
- [ ] `POST /api/data/:table` — 新增資料
- [ ] `PUT /api/data/:table/:id` — 更新資料
- [ ] `DELETE /api/data/:table/:id` — 刪除資料

---

## Phase 2：Orchestrator + Agents

### 2.1 Orchestrator（核心）
- [ ] `orchestrator.ts`：用 Claude API 的 `tool_use` 做意圖分派

Claude 收到使用者訊息後，可呼叫以下 tools：

```typescript
const tools = [
  {
    name: "manage_schema",
    description: "建立或修改資料表結構",
    input_schema: {
      type: "object",
      properties: {
        action: { enum: ["create_table", "alter_table", "describe_tables"] },
        table_name: { type: "string" },
        columns: { type: "array", items: { /* column definition */ } },
        changes: { type: "array", items: { /* alter definition */ } }
      }
    }
  },
  {
    name: "manage_ui",
    description: "建立或更新使用者介面（列表、表單）",
    input_schema: {
      type: "object",
      properties: {
        action: { enum: ["create_view", "update_view"] },
        view: { /* View Schema JSON */ }
      }
    }
  },
  {
    name: "query_data",
    description: "查詢資料、統計、聚合",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT only" },
        explanation: { type: "string" }
      }
    }
  }
]
```

### 2.2 Schema Agent
- [ ] 接收 `manage_schema` tool call
- [ ] 執行 DDL（CREATE TABLE / ALTER TABLE）
- [ ] 回傳新的 table schema
- [ ] 寫入 `_zenku_changes`
- [ ] **安全：** 只允許 DDL，拒絕 DROP DATABASE 等危險操作

### 2.3 UI Agent
- [ ] 接收 `manage_ui` tool call，或在 Schema Agent 完成後自動觸發
- [ ] 根據 table schema 生成 View 定義 JSON
- [ ] 存入 `_zenku_views`
- [ ] 寫入 `_zenku_changes`

### 2.4 Query Agent
- [ ] 接收 `query_data` tool call
- [ ] 執行 SELECT 查詢
- [ ] 回傳結果 + 自然語言摘要
- [ ] **安全：** 只允許 SELECT，statement 檢查

---

## Phase 3：前端

### 3.1 佈局
- [ ] 三欄佈局：左側 Sidebar + 中間 AppArea + 右側 ChatPanel
- [ ] 初始狀態：只有 ChatPanel 居中顯示
- [ ] 有 view 後：展開為三欄

### 3.2 ChatPanel
- [ ] 對話輸入框 + 訊息列表
- [ ] SSE 串流顯示 AI 回應
- [ ] 顯示操作結果摘要（「已建立 customers 表」）

### 3.3 Building Blocks
- [ ] `TableView`：根據 view 定義渲染表格，支援分頁、排序
- [ ] `FormView`：根據 view 定義渲染表單，支援新增/編輯
- [ ] 欄位型別映射：text→input, integer→number, enum→select, boolean→checkbox

### 3.4 Sidebar
- [ ] 從 `_zenku_views` 讀取選單項目
- [ ] 點擊切換 AppArea 顯示的 view

### 3.5 AppArea
- [ ] 根據選中的 view 定義，渲染對應的 Building Block
- [ ] CRUD 操作直接呼叫 `/api/data/:table` API

---

## Phase 4：串接 + Demo

- [ ] 跑通完整故事線：
  1. 「我要管理客戶資料，有姓名、電話、email」→ 表 + UI 出現
  2. 手動新增幾筆客戶資料
  3. 「加一個欄位叫等級，分普通跟 VIP」→ UI 自動更新
  4. 「目前有幾個 VIP 客戶？」→ 回答數字
- [ ] 處理錯誤狀態（AI 回應失敗、SQL 錯誤）
- [ ] 基本 loading 狀態

---

## View Schema 格式

這是 UI Agent 和前端之間的契約：

```typescript
interface ViewDefinition {
  id: string;
  name: string;           // 顯示名稱，如「客戶管理」
  table_name: string;     // 對應的 DB 表
  type: "table";          // PoC 只支援 table 類型
  columns: ColumnDef[];
  form: FormDef;
  actions: ("create" | "edit" | "delete")[];
}

interface ColumnDef {
  key: string;            // DB 欄位名
  label: string;          // 顯示名稱
  type: "text" | "number" | "select" | "boolean" | "date";
  sortable?: boolean;
}

interface FormDef {
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "date" | "textarea";
  required?: boolean;
  options?: string[];     // for select type
  placeholder?: string;
}
```

---

## Orchestrator System Prompt 草稿

```
你是 Zenku 的 Orchestrator。使用者透過對話描述需求，你負責建構應用。

你有以下工具：
- manage_schema：建立或修改資料表
- manage_ui：建立或更新介面
- query_data：查詢資料

規則：
1. 使用者要求建立或修改資料結構時，先呼叫 manage_schema，成功後自動呼叫 manage_ui 生成對應的介面
2. 使用者詢問資料相關問題時，呼叫 query_data
3. 回應使用繁體中文
4. 每次操作後，用簡潔的語言告訴使用者你做了什麼

目前資料庫狀態：
{current_schema}

目前介面：
{current_views}
```

---

## 不在 PoC 範圍

- 使用者認證 / 多租戶
- File Agent（上傳、OCR）
- Logic Agent（業務規則、trigger）
- Test Agent（影響評估）
- Undo / 回滾
- 圖表、看板等進階 view 類型
- 部署 / 容器化

---

## 交給 Sonnet 的指引

實作順序建議：

1. **先做 Phase 1**（骨架），確認前後端能跑、DB 能連
2. **再做 Phase 2**（agents），先不接前端，用 curl 測試 `/api/chat`
3. **再做 Phase 3**（前端），接上 API
4. **最後 Phase 4**（串接 demo），跑通故事線

每完成一個 Phase 先測試確認能跑，再進下一個。
需要 Claude API key 設為環境變數 `ANTHROPIC_API_KEY`。
