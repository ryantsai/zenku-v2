# 安全、多語言與系統限制 (Security, i18n & Constraints)

> 本文件補強了 Zenku 系統在安全管控、多語言支援以及 AI 操作邊界上的進階規格。

---

## 1. 權限與安全模型 (Security & Auth)

Zenku 支援雙軌制的身份驗證機制，分別針對「人」與「機器」設計：

### A. 使用者會話 (User Sessions)
*   **驗證方式**：基於 Bearer Token 的 Session 管理。
*   **角色等級**：
    *   `admin`：擁有全系統最高權限，可管理使用者、設定 AI Provider 與系統參數。
    *   `builder`：可使用 AI 代理進行應用程式開發、修改 Schema 與 UI 視圖。
    *   `user`：僅能操作業務功能（資料錄入、查看報表）。
*   **SSO 整合**：支援 OIDC 協議（如 Google, Azure AD），可配置為 `sso_only` 模式。

### B. API Key 存取 (API Access)
*   **格式**：以 `zk_live_` 為前綴的持久性金鑰。
*   **權限範圍 (Scopes)**：採微粒度管控（如 `data:read`, `data:write`, `schema:read`）。
*   **速率限制 (Rate Limiting)**：預設每分鐘 60 次請求，防止外部整合對系統造成過大負擔。

---

## 2. 國際化與多語言 (i18n)

系統具備自動化的多語言翻譯機制，整合了資料庫存儲與 AI 生成。

### 關鍵機制：`$key` 語法
*   在視圖定義（如 `label`）中使用 `$order_status`。
*   後端 `resolveI18n` 服務會自動偵測並從 `_zenku_translations` 表提取對應語言的內容。
*   **回退機制 (Fallback)**：若指定語言缺失，系統會回退至英文 (`en`)；若英文亦缺失，則顯示 key 去掉前綴後的原文字。

### AI 自動翻譯
當 AI 在建立新欄位時，會自動同步發送指令至 `i18n-tool`，一次性生成該欄位的繁體中文、英文與日文翻譯，確保 UI 體驗的連貫性。

---

## 3. 系統限制與 AI 邊界 (System Constraints)

為了確保系統安全性與資料完整性，AI 代理的操作受到嚴格的「沙盒化」限制：

*   **Query Agent 唯讀性**：`Query Agent` 所使用的資料庫適配器被強制限制僅能執行 `SELECT` 指令。任何嘗試執行 `DROP`, `DELETE` 或 `UPDATE` 的 SQL 都會被底層防禦攔截。
*   **Schema 變更追蹤**：所有的 DDL 變更（如刪除表或欄位）必須通過 `journal-tools` 記錄。若無反向操作定義，系統會警告 AI 禁止執行該變更。
*   **UI 與業務隔離**：`UI Agent` 被禁止直接訪問業務資料表，僅能讀寫 `_zenku_views` 元資料，防止 AI 在調整 UI 時洩漏敏感個資。
*   **附件大小限制**：檔案欄位預設上限為 10MB，僅支援常見的 MIME 類型以防止惡意腳本上傳。
