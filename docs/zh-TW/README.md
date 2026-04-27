# Zenku 系統文件目錄（繁體中文）

> **定位：** 本目錄為 Zenku 的官方繁體中文技術文件，存放於 `docs/zh-TW/`。
> 涵蓋概念說明、架構設計、功能規格與開發紀錄。所有文件皆以「已完成的設計決策」為基礎，忠實記錄現行系統的樣貌。

---

## 目錄結構

```
docs/zh-TW/
├── README.md                          ← 本文件（目錄索引）
│
├── 01-概念與願景/
│   ├── 01-zenku-concept.md            ← 產品定位、核心概念、與 iRAF 的差異
│   └── 02-design-philosophy.md        ← 關鍵設計決策與取捨原則
│
├── 02-架構設計/
│   ├── 01-system-overview.md          ← 系統全貌：Monorepo 架構、技術棧、目錄結構
│   ├── 02-multi-agent-architecture.md ← 多智能體協作架構：Orchestrator + Specialist Agents
│   ├── 03-dynamic-ui-rendering.md     ← 資料驅動 UI 渲染機制詳解
│   ├── 04-database-design.md          ← 系統表設計、業務表生命週期、遷移策略
│   └── 05-development-environment.md  ← 開發環境配置、本地啟動指引 [NEW]
│
├── 03-功能規格/
│   ├── 01-view-and-field-types.md     ← 視圖與欄位控制項完整規格
│   ├── 02-actions-and-conditional-ui.md ← 視圖動作與條件式 UI 規則
│   ├── 03-business-rules-engine.md    ← 商業規則引擎：觸發時機與動作
│   ├── 04-design-journal-undo.md      ← 設計日誌與 Undo 回滾機制
│   └── 05-security-and-i18n.md        ← 安全模型、多語言與系統限制 [NEW]
│
├── 04-AI-代理系統/
│   ├── 01-orchestrator-and-agents.md  ← 調度器職責與五大專職 Agent 架構
│   └── 02-agent-tools.md              ← Agent 工具箱與 JSON Schema 規範
│   ├── 03-agent-permissions.md        ← Agent 權限矩陣與角色存取控制
│   ├── 04-schema-agent.md             ← Schema Agent：DDL 操作、安全約束、欄位設計指引
│   ├── 05-ui-agent.md                 ← UI Agent：View 生成邏輯、JSON 格式規範
│   ├── 06-query-agent.md              ← Query Agent：SELECT 限制、資料查詢模式
│   ├── 07-logic-agent.md              ← Logic Agent：規則建立、trigger 設計
│   └── 08-test-agent.md               ← Test Agent：破壞性變更評估、assess_impact 流程
│
├── 05-整合與部署/
│   ├── 01-multi-ai-provider.md        ← 多 AI Provider 支援：Claude / OpenAI / Gemini 抽象層
│   ├── 02-webhook-n8n.md              ← Webhook 整合與 n8n 工作流串接
│   ├── 03-api-key-auth.md             ← API Key 認證機制
│   ├── 04-chat-history.md             ← 對話歷程管理：session / message / tool event 三表
│   ├── 05-ai-observability.md         ← AI 可觀測性：Token 統計、成本追蹤、延遲監控
│   ├── 06-deployment.md               ← Docker 部署、SQLite 持久化、正式環境設定
│   └── 07-system-constraints.md       ← 系統物理限制與效能邊界 [NEW]
│
├── 06-認證與權限/
│   ├── 01-authentication.md           ← 登入機制（Email + Password）、Session / JWT
│   └── 02-rbac.md                     ← 角色權限控制（admin / builder / user）
│
├── 07-開發歷程/
│   ├── 00-current-status.md           ← 系統當前狀態與功能快照 [NEW]
│   ├── 01-poc-to-mvp.md               ← 從 PoC 到 MVP 的演進過程
│   ├── 02-phase-summary.md            ← 各 Phase 完成狀態總覽（Phase 0 ~ Phase 8）
│   ├── 03-i18n-implementation.md      ← 國際化（i18n）實作紀錄：前端 + 後端錯誤碼標準化
│   ├── 04-improvement-log.md          ← 改善日誌：UI 主題、多欄佈局、使用者管理等七大模組
│   └── 05-known-issues.md             ← 已知問題與技術債紀錄
│
└── 08-參考資料/
    ├── 01-shared-type-dictionary.md   ← @zenku/shared 完整型別字典（FieldDef / ViewDefinition / ...）
    ├── 02-api-reference.md            ← REST API 端點完整清單
    ├── 03-system-tables-reference.md  ← 系統資料表（_zenku_*）Schema 完整參考
    └── 04-glossary.md                 ← 術語表（中英對照）
```

---

## 撰寫原則

1. **現在式描述**：文件描述的是「系統現在如何運作」，不是「計劃要做什麼」。
2. **設計決策留存**：重要的取捨與設計決策要記錄原因（Why），不只是 What。
3. **程式碼範例優先**：使用實際的型別定義和程式碼範例，不用模糊的文字描述。
4. **中英術語並列**：首次出現的專業術語在括號內附上英文原文。
5. **互相連結**：文件之間要有清楚的相互引用。

---

*最後更新：2026-04-27 (Antigravity 初始化)*
