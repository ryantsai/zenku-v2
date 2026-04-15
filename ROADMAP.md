# Zenku 正式版 Roadmap

> **PoC 已驗證：** 對話 → 建表 → 生成 UI → 查詢 的核心迴圈可行。
> **正式版目標：** 讓 Zenku 能承載真實的業務場景（進銷存、客戶管理、專案管理等）。

---

## 現況盤點（PoC 能做的 vs 不能做的）

| 能做 | 不能做 |
|------|--------|
| 單表 CRUD | 多表關聯 |
| 靜態下拉選單 | 動態選項來源 |
| 文字/數字/布林/日期欄位 | 圖片、檔案、金額格式 |
| 單一列表 + 表單 | Master-Detail、Dashboard |
| 全部使用者相同權限 | 角色權限控管 |
| 手寫 Tailwind | shadcn/ui 元件庫 |
| 固定寬度 Chat Panel | 可調整寬度 |

---

## Phase 1：UI 基礎升級

> **目標：** 把 PoC 的粗糙介面升級為可用的產品介面。
> **不涉及後端邏輯變更，純前端。**

### 1.1 導入 shadcn/ui
- [x] 安裝 shadcn/ui + 設定主題
- [x] 替換現有手寫元件：Button、Input、Select、Table、Dialog、Checkbox、Label
- [x] 統一設計語言（色票、間距、圓角）

### 1.2 佈局優化
- [x] Chat Panel 可拖曳調整寬度（resizable panel）
- [x] 明暗模式切換（Dark / Light）
- [x] Sidebar 可折疊
- [x] 響應式佈局（手機可用）

### 1.3 表格增強
- [x] 分頁（前端 or 後端分頁）
- [x] 欄位排序
- [x] 搜尋篩選
- [x] 欄寬可調整
- [x] 空狀態優化

### 1.4 表單增強
- [x] 表單驗證回饋（必填提示、格式驗證）
- [x] 欄位分組 / 分段顯示
- [x] 儲存成功 toast 提示

---

## Phase 2：資料模型升級

> **目標：** 支援真實業務場景的資料結構需求。
> **這是 Zenku 能否承載「進銷存」等場景的關鍵。**

### 2.1 關聯欄位（Foreign Key）
- [x] Schema Agent 支援 `REFERENCES` 語法建立外鍵
- [x] View 定義新增 `relation` 欄位型別

```typescript
interface FieldDef {
  // ... 現有欄位
  type: 'text' | 'number' | 'select' | 'relation' | /* ... */;
  relation?: {
    table: string;         // 關聯表
    display_field: string; // 顯示欄位（如 name）
    value_field: string;   // 值欄位（通常是 id）
  };
}
```

- [x] 前端 RelationField 元件：搜尋式下拉，從關聯表取選項
- [x] 對話範例：「訂單要關聯到客戶」→ 自動建外鍵 + relation 欄位

### 2.2 動態下拉選項
- [ ] FieldDef 新增 `source_table` 屬性

```typescript
interface FieldDef {
  type: 'select';
  options?: string[];          // 靜態選項（現有）
  source?: {                   // 動態選項（新增）
    table: string;             // 來源表
    value_field: string;
    display_field: string;
  };
}
```

- [x] 前端 DynamicSelect 元件：即時從 API 取選項
- [x] 新增大類後，下拉選單自動包含新項目

### 2.3 計算欄位（Computed Fields）
- [ ] FieldDef 新增 `computed` 屬性

```typescript
interface FieldDef {
  type: 'number';
  computed?: {
    formula: string;           // 'quantity * unit_price'
    dependencies: string[];    // ['quantity', 'unit_price']
  };
}
```

- [x] 前端即時計算（輸入數量和單價 → 自動算小計）
- [x] 後端儲存時也做一次計算（防繞過）
- [x] 對話範例：「小計 = 數量 × 單價」→ 自動設定公式

### 2.4 欄位型別擴充

| 新型別 | 用途 | 前端元件 |
|--------|------|----------|
| `phone` | 電話格式、點擊撥號 | 格式化輸入 |
| `email` | Email 格式驗證 | 帶驗證的 input |
| `currency` | 金額，千分位 + 小數 | 數字格式化輸入 |
| `url` | 連結，可點擊 | URL input |
| `image` | 圖片上傳 + 預覽 | 上傳元件 + 縮圖 |
| `file` | 檔案附件 | 上傳元件 + 下載連結 |
| `richtext` | 多行格式文字 | Rich text editor |
| `enum` | 明確的列舉值（badge 顯示） | Tag / Badge |

---

## Phase 3：Master-Detail 介面

> **目標：** 支援「訂單 + 訂單明細」這類一對多的業務場景。

### 3.1 View Schema 擴充

```typescript
interface ViewDefinition {
  type: 'table' | 'master-detail';   // 新增類型
  // master-detail 專用
  detail_views?: {
    table_name: string;               // 明細表
    foreign_key: string;              // 明細表中的外鍵欄位
    view: ViewDefinition;             // 明細的 view 定義（遞迴）
    tab_label: string;                // Tab 標籤（如「訂單明細」）
  }[];
}
```

### 3.2 前端 MasterDetailView 元件
- [x] 上半部：主檔表單（如訂單基本資訊）
- [x] 下半部：Tab 頁籤，每個 Tab 一個明細表格
- [x] 主檔切換時，明細自動篩選
- [x] 明細新增時，自動帶入主檔 ID

### 3.3 Schema Agent 升級
- [x] 理解「訂單明細屬於訂單」的概念
- [x] 自動建外鍵、設定 CASCADE 刪除
- [x] 對話範例：「訂單有明細，每筆明細有產品、數量、單價、小計」

---

## Phase 4：Agent 擴展

> **目標：** 完成原始概念中的 6 個 specialist agents。

### 4.1 Agent 權限矩陣

| Agent | DB 權限 | View 權限 | 檔案權限 | 可被誰呼叫 |
|-------|---------|-----------|----------|------------|
| Orchestrator | 無 | 讀 | 無 | 使用者 |
| Schema Agent | DDL | 無 | 無 | Orchestrator |
| UI Agent | 無 | 讀寫 | 無 | Orchestrator |
| Query Agent | SELECT | 無 | 無 | Orchestrator |
| File Agent | INSERT | 無 | 讀寫 | Orchestrator |
| Logic Agent | 規則表讀寫 | 無 | 無 | Orchestrator |
| Test Agent | SELECT | 讀 | 無 | Orchestrator（Schema 變更前必經） |

**使用者角色 → Agent 存取控制：**
- `admin`：可使用所有 agents
- `builder`：可使用 Schema、UI、Logic agents（可建構應用）
- `user`：只能使用 Query、File agents（只能操作資料，不能改結構）

### 4.2 File Agent
- [ ] 上傳 API（`POST /api/files`）
- [ ] 檔案儲存（本地 or S3）
- [ ] 圖片壓縮 / 縮圖
- [ ] OCR 解析（整合 Claude vision）
- [ ] CSV / Excel 匯入 → 自動建表
- [ ] 檔案與記錄關聯（`_zenku_files` 表）

### 4.3 Logic Agent
- [x] 規則引擎：`_zenku_rules` 表

```sql
CREATE TABLE _zenku_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT,     -- 'before_insert' | 'after_insert' | 'before_update' | 'on_schedule'
  table_name TEXT,       -- 觸發的表
  condition TEXT,        -- JSON: 條件運算式
  actions TEXT,          -- JSON: 動作列表
  enabled BOOLEAN DEFAULT 1
);
```

- [x] 規則類型：
  - 驗證規則：「金額不能為負」
  - 自動填值：「VIP 客戶訂單自動打 9 折」
  - 狀態流轉：「付款完成 → 訂單狀態改為已付款」
  - Webhook 觸發：「新訂單 → 呼叫 n8n webhook」
- [x] 對話範例：「VIP 客戶下單自動打 9 折」→ Logic Agent 建規則

### 4.4 Test Agent
- [x] Schema 變更前的影響評估
- [x] 檢查項目：
  - 受影響的 views 數量
  - 受影響的資料筆數
  - 受影響的 rules 數量
  - 是否有破壞性變更（刪欄位、改型別）
- [x] 回報格式：「這次變更會影響 3 個介面和 120 筆資料，要繼續嗎？」
- [x] Orchestrator 流程調整：Schema 變更 → Test Agent 評估 → 使用者確認 → 執行

---

## Phase 5：視覺化與報表

> **目標：** 讓資料不只是表格，能用圖表和 Dashboard 呈現。

### 5.1 View 類型擴充

| 類型 | 用途 | 前端元件 |
|------|------|----------|
| `table` | 列表（現有） | TableView |
| `master-detail` | 主檔+明細 | MasterDetailView |
| `dashboard` | 統計面板 | DashboardView |
| `kanban` | 看板（如任務管理） | KanbanView |
| `calendar` | 行事曆（排程場景） | CalendarView |

### 5.2 Dashboard 元件
- [x] DashboardView：由多個 widget 組成的面板

```typescript
interface DashboardWidget {
  type: 'stat_card' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'table';
  title: string;
  query: string;          // SQL
  size: 'sm' | 'md' | 'lg';
  position: { row: number; col: number };
}
```

- [x] 圖表庫：Recharts（React 生態，API 簡單）
- [x] 對話範例：「我想看每月新增客戶趨勢」→ 生成折線圖

### 5.3 Kanban 元件
- [x] 以某個 enum/status 欄位為分組
- [x] 拖曳移動卡片 = 更新狀態
- [x] 對話範例：「用看板方式管理任務」

---

## Phase 6：Design Journal + Undo

> **目標：** 跨 session 記憶 + 任意回滾。

### 6.1 Design Journal 升級

```sql
CREATE TABLE _zenku_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  session_id TEXT,         -- 對話 session
  agent TEXT,
  type TEXT,               -- 'schema' | 'view' | 'rule' | 'data_import'
  description TEXT,        -- 人可讀的描述
  diff TEXT,               -- JSON: { before, after }
  reason TEXT,             -- 為什麼做這個決定
  user_request TEXT,       -- 原始使用者需求
  reversible BOOLEAN,      -- 是否可回滾
  reverse_sql TEXT         -- 回滾用的 SQL
);
```

### 6.2 Undo 機制
- [x] Orchestrator 新增 `undo` tool
- [x] 基於 journal diff chain 反向執行
- [x] 支援粒度：
  - 「復原剛才的操作」→ 最近一筆
  - 「把訂單表回到昨天的版本」→ 找到時間點，批次回滾
- [ ] 不可逆的操作標記 warning

### 6.3 Session 記憶
- [x] 新 session 開始時，Orchestrator 讀 journal 摘要灌進 system prompt
- [x] 摘要包含：目前有哪些表、各表欄位、views、rules
- [ ] 摘要自動壓縮（超過一定長度時用 Claude 精簡）

---

## Phase 7：權限與多租戶

### 7.1 使用者認證
- [x] 登入 / 註冊（Email + 密碼 or OAuth）
- [x] Session / JWT 管理
- [x] 技術選型：NextAuth.js or Lucia

### 7.2 角色權限
- [ ] 角色定義：admin / builder / user（對應 4.1 Agent 存取控制）
- [ ] 資料層級權限：「業務只能看自己的訂單」
- [ ] 實作方式：每張使用者表加 `owner_id`，Query 自動加 WHERE 條件
- [ ] 對話範例：「業務只能看自己建立的訂單」→ 設定資料權限規則

### 7.3 多租戶（如果需要 SaaS）
- [ ] 每個租戶一個 SQLite 檔案（簡單隔離）
- [ ] 或切換到 PostgreSQL + schema-based 隔離

---

## Phase 8：外部整合與部署

### 8.1 多 AI Provider 支援
- [x] Claude / OpenAI / Gemini provider 抽象層（`server/src/ai/`）
- [x] Orchestrator 改用 provider-agnostic `AIProvider.chat()` 介面
- [x] ChatPanel provider/model 選擇器（>1 provider 時顯示）
- [x] `GET /api/ai/providers` 偵測已設定的 API key

### 8.2 對話歷程管理
- [x] `_zenku_chat_sessions` / `_zenku_chat_messages` / `_zenku_tool_events` 三表
- [x] `tools/chat-logger.ts`：session 建立、訊息記錄、tool event 記錄、token 統計
- [x] Orchestrator 每次 chat 完整記錄；SSE 新增 `usage` chunk

### 8.3 管理者對話歷程 UI
- [x] `GET /api/admin/sessions`、`/sessions/:id`、`/usage` 端點
- [x] `ChatHistory.tsx`、`SessionDetail.tsx`、`UsageStats.tsx` 元件
- [x] UserMenu 新增管理員專屬入口

### 8.4 Webhook / n8n 整合
- [x] Logic Agent 支援 `webhook` action type（規則引擎已實作）
- [x] `POST /api/webhook/callback`（HMAC-SHA256 驗證 + 記錄 journal）
- [x] `.env.example` 新增 `WEBHOOK_SECRET`

### 8.5 部署
- [x] `Dockerfile`（multi-stage，node:24-slim）
- [x] `docker-compose.yml`（volume 持久化 SQLite、healthcheck）
- [x] Production 靜態服務（Express serve 前端 + SPA fallback）
- [ ] API Key 認證（對外 RESTful API）
- [ ] Rate limiting
- [ ] PostgreSQL 遷移路徑

---

## 技術棧演進

| 層 | PoC | 正式版 |
|----|-----|--------|
| Frontend | React + 手寫 Tailwind | React + **shadcn/ui** + Tailwind |
| 圖表 | 無 | **Recharts** |
| Backend | Express + node:sqlite | Express + **node:sqlite**（考慮 PostgreSQL 選項） |
| AI | Claude API (non-streaming) | Claude API (**streaming**) |
| 認證 | 無 | **NextAuth.js / Lucia** |
| 部署 | 本地 | **Docker** |
| 整合 | 無 | **Webhook + n8n** |

---

## 建議實作順序

```
Phase 1（UI 升級）      ← 最先做，立即改善體驗
    ↓
Phase 2（資料模型）     ← 核心能力，決定能承載哪些場景
    ↓
Phase 3（Master-Detail）← 依賴 Phase 2 的關聯欄位
    ↓
Phase 4（Agent 擴展）   ← 依賴 Phase 2/3 的資料模型
    ↓
Phase 5（視覺化）       ← 需要有足夠的資料結構才有意義
    ↓
Phase 6（Journal/Undo） ← 可以跟 Phase 4/5 平行做
    ↓
Phase 7（權限）         ← 接近上線前做
    ↓
Phase 8（整合/部署）    ← 最後上線
```

Phase 1~3 是第一個里程碑，完成後 Zenku 就能承載「進銷存」等真實場景。
Phase 4~5 是第二個里程碑，完成後具備完整的 AI 應用建構能力。
Phase 6~8 是上線準備。
