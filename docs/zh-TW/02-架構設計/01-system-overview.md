# 系統全貌 (System Overview)

> 本文件描述 Zenku 的技術棧、軟體架構以及目錄組織結構，旨在提供開發者對系統全貌的技術理解。

---

## 1. 架構模式：Monorepo
Zenku 採用 **Monorepo (基於 npm workspaces)** 的開發模式，確保前後端型別定義同步，並簡化本地開發與部署流程。

*   **套件路徑**：`packages/*`
*   **套件管理**：npm v7+ / npm workspaces

---

## 2. 技術棧 (Technology Stack)

### 前端 (`@zenku/web`)
*   **框架**：React 19 (Vite)
*   **語言**：TypeScript
*   **樣式**：Tailwind CSS + shadcn/ui + Radix UI
*   **狀態管理與路由**：React Context API + React Router 7
*   **關鍵組件**：
    *   表格：`@tanstack/react-table`
    *   圖表：`recharts`
    *   拖曳：`@dnd-kit`
    *   編輯器：`tiptap` (Rich Text) / `CodeMirror` (JSON/SQL)
    *   多語言：`i18next`

### 後端 (`@zenku/server`)
*   **運行環境**：Node.js
*   **伺服器框架**：Express
*   **資料庫層**：
    *   **抽象層**：`src/db/adapter.ts`
    *   **實作層**：支援 **SQLite** (預設)、**PostgreSQL** 與 **MSSQL**。
*   **AI 整合**：支援多個 LLM 供應商：
    *   **Anthropic** (Claude 3/3.5)
    *   **OpenAI** (GPT-4o)
    *   **Google** (Gemini 1.5/2.0)

### 共用模組 (`@zenku/shared`)
*   **型別定義**：定義 `FieldDef`, `ViewDefinition`, `RuleDef` 等核心資料結構。
*   **邏輯引擎**：包含 `appearance.ts` (UI 條件引擎) 與公式解析器。

---

## 3. 目錄結構與職責

### 後端目錄 (`packages/server/src/`)
| 目錄/檔案 | 職責說明 |
| :--- | :--- |
| `agents/` | 專職 AI 代理 (Schema, UI, Logic, Query, Test) 的邏輯實現。 |
| `ai/` | LLM Provider 的抽象封裝與對話管理。 |
| `db/` | 資料庫適配器與各系統表 (`_zenku_*`) 的資料存取邏輯。 |
| `engine/` | 商業規則與觸發器 (Trigger) 的執行引擎。 |
| `routes/` | REST API 路由定義 (Data, View, Rules, Chat 等)。 |
| `tools/` | 開放給 AI 呼叫的工具集 (Function Calling Definitions)。 |
| `orchestrator.ts` | 系統核心調度邏輯，與 LLM 互動的中樞。 |

### 前端目錄 (`packages/web/src/`)
| 目錄/檔案 | 職責說明 |
| :--- | :--- |
| `components/` | 共用 UI 元件 (Shadcn) 與業務元件。 |
| `views/` | 動態渲染的核心畫布元件 (`TableView`, `FormView`, `KanbanView` 等)。 |
| `contexts/` | 全域狀態管理 (ViewsContext, ChatContext, AuthContext)。 |
| `lib/` | 工具函式、API 客戶端封裝。 |
| `AppArea.tsx` | 動態路由分發器，根據 View Definition 決定渲染型態。 |

---

## 4. 關鍵運作機制

1.  **啟動機制**：伺服器啟動時，若指定資料庫不存在或為空，會透過 `src/db/index.ts` 自動初始化系統表 (`_zenku_*`)。
2.  **型別安全**：透過 Monorepo，後端的 DTO (Data Transfer Object) 與前端的 Props 共享同一個 `shared` 套件的定義。
3.  **環境變數**：由 `.env` 統一管理 AI API Keys 與資料庫連線字串。
