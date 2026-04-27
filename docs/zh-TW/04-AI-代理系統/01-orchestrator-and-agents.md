# AI 代理系統架構 (AI Multi-Agent System)

> Zenku 並非一個單一的大型模型應用，而是一個由中心調度器 (Orchestrator) 指揮的多 Agent 協作系統。

---

## 1. 中心調度器 (The Orchestrator)

`orchestrator.ts` 是系統的大腦，負責接收使用者訊息，並決定呼叫哪些專職 Agent 來完成任務。

### 核心工作流：
1.  **動態上下文注入 (`buildDynamicContext`)**：每次對話前，調度器會即時從資料庫提取當前的「表結構」、「現有視圖」、「商業規則」以及「設計日誌」。這確保了 AI 永遠是在最新的系統狀態下思考。
2.  **工具映射 (Tool Dispatch)**：將 LLM 的 Tool Call 映射到具體的 Agent 處理器上。
3.  **對話觀測 (Observability)**：透過 `chat-logger` 記錄每一輪對話的 Token 消耗、延遲以及 Tool 執行的成功率。

---

## 2. 專職代理人 (Specialized Agents)

系統將權限與職責劃分為五個虛擬代理人，每個代理人擁有特定的工具箱：

| 代理人 (Agent) | 職責 | 關鍵工具 |
| :--- | :--- | :--- |
| **Schema Agent** | 資料庫結構建模。 | `manage_schema` (create/alter table) |
| **UI Agent** | 畫布設計與介面渲染邏輯。 | `manage_ui` (create/get view) |
| **Logic Agent** | 商業自動化與驗證邏輯。 | `manage_rules` (triggers/actions) |
| **Query Agent** | 唯讀資料查詢與統計分析。 | `query_data` (SELECT only) |
| **Test Agent** | 破壞性變更的風險評估。 | `assess_impact` |

---

## 3. 提示詞工程 (Prompt Engineering)

調度器的 System Prompt 是由多個高度模組化的指令片段 (`prompts/`) 組成，包含：
*   **視覺化介面指南**：如何根據業務場景選擇 Kanban, Calendar 或 Dashboard。
*   **欄位控制項指南**：何時該使用 `auto_number` 或 `relation`。
*   **安全原則**：嚴格限制 Agent 執行未經授權的跨表操作。

---

## 4. 角色與權限邊界

AI 的「工具箱」會根據當前使用者的 `UserRole` 動態調整：
*   **Admin/Builder**：擁有完整的設計工具箱（含 Schema, UI, Rules）。
*   **User**：僅能使用 `query_data` 與 `write_data`，完全無法觸及系統結構的修改工具。

---

## 5. 跨 Agent 協作範例

當使用者說：「我想做一個訂單系統，單號要自動生成，並且出貨後要扣庫存。」

1.  **Schema Agent**：建立 `orders` 與 `inventory` 表。
2.  **UI Agent**：建立訂單列表視圖，並配置 `auto_number` 欄位。
3.  **Logic Agent**：建立一條 `after_update` 規則，當 `status` 變為「已出貨」時，執行 `update_related_records` 扣除庫存。
4.  **Orchestrator**：協調整個過程，並以繁體中文向使用者回報進度。
