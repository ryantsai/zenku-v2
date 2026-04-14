# Zenku（禪空）— 用對話建立你的資料應用

> **定位：** AI-first application builder。
> 起點只有一個對話框 + 空 DB + 空資料夾，使用者透過自然語言描述需求，AI 從零建構整個應用。

---

## 與 iRAF 的差異

| | iRAF | Zenku |
|---|---|---|
| 起點 | 開發者定義 entity / module | 空白對話框 |
| AI 角色 | 輔助使用者操作既有資料 | 主體，負責建構整個應用 |
| UI | 框架驅動（PluginRegistry） | AI 動態生成 |
| 適用對象 | 開發者 | 非技術使用者 |

---

## 核心架構：Orchestrator + Specialist Agents

```
使用者 ←→ [Orchestrator Agent]
                │
                ├── Schema Agent     — 資料結構設計、建表、遷移
                ├── UI Agent         — 畫面生成、選單組織、佈局
                ├── Query Agent      — 資料查詢、聚合、報表
                ├── File Agent       — 文件管理、上傳解析、OCR
                ├── Logic Agent      — 業務規則、驗證、自動化流程
                └── Test Agent       — 驗證變更、影響評估、資料完整性
```

### Orchestrator Agent
- 使用者對話的唯一入口
- 判斷意圖，分工給 specialist agents
- 不直接執行任何操作，只做協調
- 整合各 agent 回報，組成使用者可讀的回應

### Schema Agent
- **權限：** DDL（CREATE TABLE, ALTER TABLE）
- **Tools：** `create_table`, `alter_table`, `create_index`, `describe_table`
- **職責：** 正規化設計、資料型別映射、關聯結構
- **自我約束：** 改名/刪欄位前必須通過 Test Agent 評估

### UI Agent
- **權限：** View registry 讀寫
- **Tools：** `create_view`, `update_view`, `create_menu_item`, `register_action_button`
- **輸入：** Schema Agent 產出的表結構
- **輸出：** View 定義 JSON（building blocks 組合，非程式碼生成）
- **不碰 DB**

### Query Agent
- **權限：** DB 唯讀（SELECT only）
- **Tools：** `query`, `aggregate`, `export_csv`
- **職責：** 回答「有多少客戶？」「上個月營收？」等問題

### File Agent
- **權限：** 檔案系統讀寫
- **Tools：** `upload`, `parse_document`, `ocr_image`, `extract_table`
- **流程：** 使用者丟截圖 → 解析 → 結構化資料 → 轉給 Schema Agent 建表

### Logic Agent
- **Tools：** `create_rule`, `create_trigger`, `create_validation`
- **範例：** 「VIP 客戶下單自動打 9 折」→ 建立 trigger rule
- **規則存在 DB，runtime 引擎套用**

### Test Agent
- **Tools：** `validate_schema`, `check_data_integrity`, `dry_run_migration`
- **流程：** Schema Agent 每次改結構前，Orchestrator 先派 Test Agent 評估
- **回報範例：** 「這次變更會影響 3 個 view 和 120 筆資料，要繼續嗎？」

---

## 使用者體驗演化

```
第一次打開：只有一個對話框

「我要管理客戶資料」
→ Schema Agent 建 customers 表
→ UI Agent 建列表 + 表單 + 選單項目
→ 畫面左邊冒出「客戶管理」選單

「客戶有分等級，VIP 要標記」
→ Schema Agent 加 tier 欄位（enum: normal/vip）
→ UI Agent 更新表單 + 列表加 VIP badge

「我想看每月新增客戶的趨勢」
→ Query Agent 分析資料
→ UI Agent 生成折線圖 Dashboard

「把上個月的合約掃描檔放進來」
→ File Agent 建文件區，關聯到客戶記錄
```

---

## 關鍵設計決策

### 1. View 生成方式
**元件組合（Building Blocks），非程式碼生成。**
- 預定義一組 UI 元件：表格、表單、圖表、卡片、看板
- UI Agent 從中選擇並組合，輸出 view 定義 JSON
- 優點：穩定、可預測、無 XSS 風險
- 未來可選擇性加入「生成程式碼」作為進階選項

### 2. Agent 間通訊
**Orchestrator 中央 hub，初期不用 event bus。**
- Agent 之間不直接對話
- 所有訊息流過 Orchestrator
- 降低複雜度，未來再考慮 event-driven 架構

### 3. Context 隔離
每個 agent 只看到自己職責範圍：
- Schema Agent 看 DB schema，看不到 UI 定義
- UI Agent 看 view registry + schema（唯讀）
- Query Agent 只有 SELECT 權限
→ 安全性 + token 效率雙重好處

### 4. Design Journal（設計日誌）
解決 AI 跨 session 記憶問題：

```sql
design_decisions (
  id, timestamp,
  agent,          -- who made it
  type,           -- schema_change / ui_change / rule_change
  description,    -- human-readable
  diff,           -- JSON: before → after
  reason,         -- 為什麼做這個決定
  user_request    -- 原始使用者需求
)
```

- 每個 agent 每次執行都寫 journal
- 新 session 開始時，Orchestrator 讀 journal 摘要灌進 context

### 5. Undo 機制
基於 journal diff chain 的任意回滾：
- 「把剛才建的表刪掉」→ Schema Agent 讀 journal 反向操作
- 「訂單表回到昨天的版本」→ 找到對應的 diff chain 回滾

---

## 待決定

- **資料儲存策略：** Schema-on-write（定義表結構再存）vs JSON document + 虛擬 schema（先存再說）
- **技術棧選擇：** 是否復用 iRAF 的 building blocks（PluginRegistry、DetailView、ListView）
- **Orchestrator routing 邏輑：** 規則式 vs 讓 LLM 自己判斷分派
- **第一個 PoC scope：** 最小可展示版本要有什麼
