# 設計日誌與 Undo 回滾機制 (Design Journal & Undo)

> 為了提升 AI 操作的容錯性，Zenku 將所有的結構變更與商業規則異動視為「可逆的交易流」。這不僅能解決 AI 的記憶問題，更能讓使用者隨時「悔棋」。

---

## 1. 設計日誌 (`_zenku_journal`)

每一項透過 AI 代理執行的變更（Schema, UI, Rules）都會寫入日誌。每條日誌包含以下關鍵資訊：

*   **脈絡資訊**：哪位 Agent 執行、變更類型、描述、原因以及原始的使用者需求。
*   **資料 Diff**：變更前 (`before`) 與變更後 (`after`) 的完整 JSON 狀態。
*   **可逆性標記 (`reversible`)**：並非所有操作都可自動回滾（如刪除大量資料後的 DDL 變更）。
*   **反向操作 (`reverse_operations`)**：**核心關鍵**。儲存了還原此動作所需的反向 SQL 或反向 API 呼叫。

---

## 2. 反向操作類型 (Reverse Operations)

當變更發生時，執行 Agent 會預先計算還原所需的步驟：
*   **`sql`**：反向 SQL 語句（如 `CREATE TABLE` 對應 `DROP TABLE`）。
*   **`drop_column` / `drop_table`**：專門用於結構還原。
*   **JSON Diff 還原**：用於還原 UI View 或 Rules 的 JSON 設定。

---

## 3. Undo 回滾模式

透過 `undo_action` 工具，AI 支援三種回滾模式：

### A. 單步回滾 (`target=last`)
撤銷「最近一次」的可逆操作。這是最常用的模式，使用者說「不對，剛才那個欄位不要加」時觸發。

### B. 指定回滾 (`target=by_id`)
根據 Journal ID 撤銷特定的歷史操作。

### C. 批次時光機 (`target=by_time`)
撤銷指定時間點之後的所有操作。適用於使用者想要「回到今天早上 9 點的系統狀態」時。

---

## 4. 運作流程

1.  **紀錄**：`Schema Agent` 新增欄位 → 計算反向 SQL (`ALTER TABLE DROP COLUMN`) → 寫入 `_zenku_journal`。
2.  **觸發**：使用者輸入「Undo」。
3.  **執行**：`Orchestrator` 呼叫 `undo_action` → 讀取日誌中的 `reverse_operations` → 依序執行還原 SQL。
4.  **標記**：將該條日誌標記為 `reversed=1`，防止重複回滾。

---

## 5. 設計日誌的額外用途：AI 上下文注入

當開啟新的對話 Session 時，`Orchestrator` 會讀取最近的設計日誌摘要。這讓 AI 能夠快速理解：
*   「這張表是為什麼建立的？」
*   「上次修改 UI 是為了滿足什麼需求？」
這彌補了 LLM 本身沒有持久記憶的缺陷，讓系統的演進具備連貫性。
