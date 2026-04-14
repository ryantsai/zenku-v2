# Zenku 正式版架構設計 — 總覽

> 每個 Phase 的詳細設計在獨立檔案中。
> 本文件為索引 + 核心型別系統定義。

---

## Phase 索引

| Phase | 文件 | 主題 | 建議模型 |
|-------|------|------|----------|
| 0 | [phase-0-shared-types.md](phase-0-shared-types.md) | 共用型別系統（所有 Phase 的基底） | **Opus**（定型別要精準） |
| 1 | [phase-1-ui-upgrade.md](phase-1-ui-upgrade.md) | UI 升級：shadcn/ui、暗色、可調寬度、表格增強 | **Sonnet**（大量元件替換，模式固定） |
| 2 | [phase-2-data-model.md](phase-2-data-model.md) | 資料模型：關聯、動態選項、計算欄位、欄位類型擴充 | **Opus 設計** → **Sonnet 實作** |
| 3 | [phase-3-master-detail.md](phase-3-master-detail.md) | Master-Detail 介面 | **Sonnet**（依賴 P2，UI 密集） |
| 4 | [phase-4-agents.md](phase-4-agents.md) | Agent 擴展：File/Logic/Test + 權限矩陣 | **Opus**（Prompt 設計 + 規則引擎） |
| 5 | [phase-5-visualization.md](phase-5-visualization.md) | 視覺化：Dashboard、Kanban、Calendar | **Sonnet**（圖表元件套用） |
| 6 | [phase-6-journal-undo.md](phase-6-journal-undo.md) | Design Journal + Undo 機制 | **Sonnet** |
| 7 | [phase-7-auth.md](phase-7-auth.md) | 權限與多租戶 | **Sonnet**（成熟模式） |
| 8 | [phase-8-integration.md](phase-8-integration.md) | 多 AI Provider + 對話歷程 + n8n + 部署 | **Opus 設計** → **Sonnet 實作** |

---

## 新增需求（已納入各 Phase）

| 需求 | 納入 Phase | 說明 |
|------|-----------|------|
| 多 AI Provider（Claude/OpenAI/Gemini） | **P8** | 抽象 Provider 層，可切換模型 |
| 對話歷程管理 | **P8** | 記錄所有訊息、工具使用、思考鏈、token、延遲 |
| 管理者審計面板 | **P8** | Admin 查看所有使用者對話、用量統計、費用追蹤 |

---

## 模型分工總結

| 模型 | 適合的工作 | 分配的 Phase |
|------|-----------|-------------|
| **Opus** | 架構決策、型別設計、Prompt engineering、複雜邏輯 | P0 型別、P2 設計、P4 Agent prompt、P8 Provider 抽象層 |
| **Sonnet** | 大量實作、元件搬遷、模式重複的程式碼 | P1、P2 實作、P3、P5、P6、P7、P8 實作 |
| **Codex** | 批次重構、機械式替換 | P1 元件替換（shadcn 搬遷）可選用 |
| **Gemini Flash** | 簡單重複任務、boilerplate | P1 shadcn 元件安裝可選用 |

---

## 目錄結構（正式版完整規劃）

```
zenku/
├── docs/                           # 設計文件
├── packages/
│   ├── shared/                     # 前後端共用型別（Phase 0 新增）
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── field.ts        # FieldDef（含 relation, computed, source）
│   │   │   │   ├── view.ts         # ViewDefinition + 所有 Block 型別
│   │   │   │   ├── agent.ts        # AgentResult, AgentPermission
│   │   │   │   ├── rule.ts         # Rule 定義（Logic Agent）
│   │   │   │   └── journal.ts      # Design Journal 型別
│   │   │   ├── formula.ts          # 公式計算引擎（前後端共用）
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── orchestrator.ts
│   │   │   ├── agents/
│   │   │   │   ├── schema-agent.ts
│   │   │   │   ├── ui-agent.ts
│   │   │   │   ├── query-agent.ts
│   │   │   │   ├── file-agent.ts   # Phase 4
│   │   │   │   ├── logic-agent.ts  # Phase 4
│   │   │   │   └── test-agent.ts   # Phase 4
│   │   │   ├── tools/
│   │   │   │   ├── db-tools.ts
│   │   │   │   ├── view-tools.ts
│   │   │   │   ├── file-tools.ts   # Phase 4
│   │   │   │   ├── rule-tools.ts   # Phase 4
│   │   │   │   └── journal-tools.ts # Phase 6
│   │   │   ├── engine/
│   │   │   │   ├── rule-engine.ts  # Phase 4
│   │   │   │   └── formula.ts     # Phase 2（引用 @zenku/shared）
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # Phase 7
│   │   │   │   └── permission.ts  # Phase 7
│   │   │   └── db.ts
│   │   └── uploads/                # Phase 4
│   │
│   └── web/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── layout/          # Phase 1 重構
│       │   │   ├── chat/
│       │   │   ├── sidebar/
│       │   │   ├── blocks/          # Phase 1~5 逐步擴充
│       │   │   ├── fields/          # Phase 2 新增
│       │   │   └── auth/            # Phase 7
│       │   ├── hooks/
│       │   └── lib/
│       └── components/ui/           # shadcn/ui（Phase 1）
```
