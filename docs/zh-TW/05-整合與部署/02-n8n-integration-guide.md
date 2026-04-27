# n8n 整合實戰指南 (n8n Integration Guide)

> 本文件提供將 Zenku 與 n8n 自動化流程串接的完整教學，包含雙向通訊、權限配置與常見問題排解。

---

## 1. 雙向通訊架構

```
┌──────────────┐   after_insert webhook   ┌──────────┐   PATCH /api/ext/data/:table/:id
│    Zenku     │  ───────────────────────► │   n8n    │  ────────────────────────────────►  Zenku
│  (host:3001) │                           │ (docker) │                                     (資料回填)
└──────────────┘                           └──────────┘
```

*   **Zenku 運行於宿主機**（預設連接埠 `3001`）。
*   **n8n 運行於 Docker**：從 n8n 呼叫 Zenku 時，必須使用 `http://host.docker.internal:3001`。

---

## 2. 身份驗證與權限 (Auth & Scopes)

### API Key 格式
`zk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 權限對照表
| 權限範圍 (Scope) | 授權內容 |
| :--- | :--- |
| `read:*` | 讀取所有資料表。 |
| `write:*` | 寫入/更新所有資料表。 |
| `webhook:callback` | 使用專用的 `/webhook/callback` 回填端點。 |
| `mcp:*` | 允許外部 AI Agent 透過 MCP 操控系統。 |

---

## 3. 實作步驟：從 Zenku 推送到 n8n

1.  **在 Zenku 設定規則**：
    *   進入 `Settings` → `Rules`。
    *   Trigger: `after_insert`。
    *   Action: `webhook`。
    *   URL: 貼上您的 n8n Webhook URL。
2.  **n8n Webhook 節點設定**：
    *   **HTTP Method**: `POST`。
    *   **Response Mode**: 務必設為 `responseNode`（防止連線過早中斷）。
3.  **Payload 結構**：
    Zenku 推送的 JSON 會包含 `{ "table": "...", "action": "insert", "data": { ... } }`。

---

## 4. 實作步驟：從 n8n 回填至 Zenku

這是最常見的場景：n8n 處理完 AI 任務後，將結果寫回 Zenku。

### 建議方式：使用 HTTP Request 節點 (PATCH)
*   **Method**: `PATCH`。
*   **URL**: `http://host.docker.internal:3001/api/ext/data/{{table}}/{{id}}`。
*   **Authentication**: 選擇 `Predefined Credential Type` → `httpBearerAuth`。
*   **Body**: 僅發送需要更新的欄位，例如 `{ "status": "已完成", "result": "AI 分析內容" }`。

---

## 5. 常見錯誤排查 (Troubleshooting)

| 錯誤訊息 | 可能原因 | 解決方案 |
| :--- | :--- | :--- |
| `ECONNREFUSED` | n8n 嘗試連向 `localhost`。 | 改用 `host.docker.internal`。 |
| `401 Unauthorized` | API Key 錯誤或路徑不對。 | 確保路徑以 `/api/ext/` 開頭，並檢查 Bearer Token。 |
| `403 Forbidden` | API Key 缺少 `write` 權限。 | 在 Zenku 設定中調升該 Key 的 Scopes。 |
| 欄位顯示 `{{id}}` 原文字 | n8n URL 欄位未開啟 Expression 模式。 | 點擊 URL 欄位旁的「反摺線/大括號」圖示開啟運算式。 |
| Webhook Node 報錯 | Webhook Trigger 設為立即回傳。 | 將 Response Mode 改為 `On Received` 或 `Response to Webhook Node`。 |
