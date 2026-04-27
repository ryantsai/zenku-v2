# 開發環境配置 (Development Environment)

> 本文件指引開發者如何從零開始配置 Zenku 的開發環境並在本地啟動專案。

---

## 1. 系統需求
*   **Node.js**：v18 或更高版本。
*   **npm**：v7 或更高版本（需支援 Workspaces）。
*   **作業系統**：Windows / macOS / Linux。

---

## 2. 快速啟動流程

### 第一步：安裝依賴
在專案根目錄執行：
```bash
npm install
```

### 第二步：配置環境變數
將根目錄的 `.env.example` 複製為 `.env`，並至少配置一個 AI 供應商的 API Key：
```bash
cp .env.example .env
```
編輯 `.env`：
```ini
ANTHROPIC_API_KEY=your_key_here
DEFAULT_AI_PROVIDER=claude
DB_TYPE=sqlite
```

### 第三步：啟動開發伺服器
```bash
npm run dev
```
此指令會同時啟動：
*   **後端**：`http://localhost:3001`
*   **前端**：`http://localhost:5173`

---

## 3. 重要指令 (Scripts)

| 指令 | 說明 |
| :--- | :--- |
| `npm run dev` | 啟動開發模式（含後端 tsx watch 與前端 Vite）。 |
| `npm run build` | 編譯前後端專案為正式發佈版本。 |
| `npm run dev -w packages/server` | 僅啟動後端開發模式。 |
| `npm run dev -w packages/web` | 僅啟動前端開發模式。 |

---

## 4. 資料庫初始化
*   **SQLite (預設)**：系統會在根目錄自動建立 `zenku.db` 檔案，並自動初始化所有系統資料表。
*   **Postgres / MSSQL**：若切換 DB，請確保 `DB_URL` 正確，系統同樣會於首次啟動時自動初始化結構。

---

## 5. 常見問題排查
*   **連接埠衝突**：如果 3001 或 5173 埠被佔用，`npm run dev` 會嘗試呼叫 `kill-port` 釋放資源。
*   **AI 回應失敗**：請檢查 `.env` 中的 `DEFAULT_AI_PROVIDER` 與模型名稱是否匹配。
*   **型別錯誤**：若修改了 `packages/shared` 的內容，建議執行 `npm run build` 以確保型別緩存更新。
