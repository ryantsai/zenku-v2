# Phase 4：Agent 擴展

> **目標：** 完成 File Agent、Logic Agent、Test Agent，並建立 Agent 權限控管。
> **建議模型：Opus**（Prompt 設計 + 規則引擎核心邏輯）
> **Sonnet 可做 File upload UI 和 rule CRUD**。

---

## 4.1 Orchestrator 升級

### Tool 清單擴展

```typescript
const TOOLS: Anthropic.Tool[] = [
  // 現有
  { name: 'manage_schema',  description: '建立或修改資料表結構' },
  { name: 'manage_ui',      description: '建立或更新使用者介面' },
  { name: 'query_data',     description: '查詢資料' },
  // 新增
  { name: 'manage_files',   description: '上傳、解析、管理檔案和圖片' },
  { name: 'manage_rules',   description: '建立或修改業務規則（自動化流程、驗證）' },
  { name: 'assess_impact',  description: '評估 schema 變更的影響（變更前必須先呼叫）' },
];
```

### 流程變更：Schema 變更必經 Test Agent

```
破壞性變更（drop_column, rename_column, change_type）：
  1. Orchestrator 先呼叫 assess_impact
  2. Test Agent 回報影響範圍
  3. Orchestrator 把影響告知使用者，詢問確認
  4. 使用者確認後才執行 manage_schema

非破壞性變更（add_column）：
  直接執行 manage_schema，不需 assess_impact
```

---

## 4.2 Agent 權限矩陣

### 權限表

| Agent | DB 權限 | View 權限 | 檔案權限 | admin | builder | user |
|-------|---------|-----------|----------|-------|---------|------|
| Orchestrator | 無 | 讀 | 無 | ✓ | ✓ | ✓ |
| Schema Agent | DDL | 無 | 無 | ✓ | ✓ | ✗ |
| UI Agent | 無 | 讀寫 | 無 | ✓ | ✓ | ✗ |
| Query Agent | SELECT | 無 | 無 | ✓ | ✓ | ✓ |
| File Agent | INSERT | 無 | 讀寫 | ✓ | ✓ | ✓ |
| Logic Agent | 規則表讀寫 | 無 | 無 | ✓ | ✓ | ✗ |
| Test Agent | SELECT | 讀 | 無 | ✓ | ✓ | ✗ |

### 實作

```typescript
// server/src/middleware/permission.ts
import { AGENT_PERMISSIONS } from '@zenku/shared';

export function canUserAccessAgent(userRole: UserRole, agentName: AgentName): boolean {
  const perm = AGENT_PERMISSIONS.find(p => p.agent === agentName);
  return perm?.allowed_by_roles.includes(userRole) ?? false;
}
```

```typescript
// orchestrator.ts — tool 執行前檢查
if (toolName === 'manage_schema' && !canUserAccessAgent(user.role, 'schema')) {
  result = { success: false, message: '你的權限不足以修改資料結構，請聯繫管理員' };
}
```

### Orchestrator System Prompt 動態調整

```typescript
// 依使用者角色，只提供可用的 tools
function getToolsForRole(role: UserRole): Anthropic.Tool[] {
  return TOOLS.filter(tool => {
    const agentName = toolToAgent(tool.name);
    return canUserAccessAgent(role, agentName);
  });
}
```

---

## 4.3 File Agent

### 系統表

```sql
CREATE TABLE _zenku_files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  table_name TEXT,           -- 關聯到哪張表（可 null）
  record_id INTEGER,         -- 關聯到哪筆記錄（可 null）
  field_key TEXT,            -- 關聯到哪個欄位（可 null）
  uploaded_by TEXT,          -- user_id
  uploaded_at TEXT DEFAULT (datetime('now'))
);
```

### Tool 定義

```typescript
{
  name: 'manage_files',
  input_schema: {
    properties: {
      action: { enum: ['upload', 'parse_csv', 'parse_image', 'list', 'delete'] },
      // upload：前端已上傳到 /api/files，AI 只需處理關聯
      file_id: { type: 'string' },
      // parse_csv：解析 CSV 自動建表
      // parse_image：OCR 解析圖片
    }
  }
}
```

### API

```typescript
// 檔案上傳（前端直接呼叫，不經 AI）
app.post('/api/files', multer.single('file'), (req, res) => {
  // 存檔到 uploads/
  // 寫入 _zenku_files
  // 回傳 file record
});

// 取得檔案
app.get('/api/files/:id', (req, res) => {
  // 從 _zenku_files 查路徑
  // res.sendFile()
});

// 列出某記錄的附件
app.get('/api/files?table=orders&record_id=1', (req, res) => {
  // 查 _zenku_files
});
```

### CSV 匯入流程

```
使用者上傳 CSV
    ↓
前端 POST /api/files → 存檔
    ↓
使用者：「幫我把這個客戶名單匯入」
    ↓
Orchestrator → manage_files({ action: 'parse_csv', file_id: '...' })
    ↓
File Agent：
  1. 讀取 CSV header → 推斷欄位（name TEXT, email TEXT, phone TEXT）
  2. 呼叫 Schema Agent 建表（或配對現有表）
  3. 批次 INSERT 資料
  4. 呼叫 UI Agent 建 view
```

### 圖片 OCR 流程

```
使用者上傳截圖
    ↓
Orchestrator → manage_files({ action: 'parse_image', file_id: '...' })
    ↓
File Agent：
  1. 讀取圖片
  2. 呼叫 Claude Vision API 解析
  3. 結構化資料 → 推斷 schema
  4. 問使用者確認後建表 + 匯入
```

### 前端元件

```
components/fields/ImageField.tsx   — 圖片上傳 + 預覽
components/fields/FileField.tsx    — 檔案上傳 + 下載連結
```

---

## 4.4 Logic Agent

### 系統表

```sql
CREATE TABLE _zenku_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  table_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,   -- before_insert, after_insert, ...
  condition TEXT,               -- JSON
  actions TEXT NOT NULL,        -- JSON array of RuleAction
  priority INTEGER DEFAULT 0,  -- 同 trigger 多條 rule 的執行順序
  enabled BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Tool 定義

```typescript
{
  name: 'manage_rules',
  input_schema: {
    properties: {
      action: { enum: ['create_rule', 'update_rule', 'delete_rule', 'list_rules'] },
      rule: {
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          table_name: { type: 'string' },
          trigger_type: { enum: ['before_insert', 'after_insert', 'before_update', 'after_update', 'before_delete'] },
          condition: {
            properties: {
              field: { type: 'string' },
              operator: { enum: ['eq', 'neq', 'gt', 'lt', 'contains', 'changed'] },
              value: {}
            }
          },
          actions: {
            type: 'array',
            items: {
              properties: {
                type: { enum: ['set_field', 'validate', 'webhook', 'create_record', 'notify'] },
                // ... 各 type 的參數
              }
            }
          }
        }
      }
    }
  }
}
```

### Rule Engine

```typescript
// server/src/engine/rule-engine.ts

export class RuleEngine {
  // 在 CRUD API 的適當時機呼叫
  async executeBefore(
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>,
    oldData?: Record<string, unknown>
  ): Promise<{ allowed: boolean; data: Record<string, unknown>; errors: string[] }> {

    const rules = this.getRulesForTrigger(table, `before_${action}`);
    let errors: string[] = [];
    let currentData = { ...data };

    for (const rule of rules) {
      if (!this.evaluateCondition(rule.condition, currentData, oldData)) continue;

      for (const action of rule.actions) {
        if (action.type === 'validate') {
          if (!this.evaluateValidation(action, currentData)) {
            errors.push(action.message);
          }
        }
        if (action.type === 'set_field') {
          currentData[action.field] = this.evaluateExpression(action.value, currentData);
        }
      }
    }

    return { allowed: errors.length === 0, data: currentData, errors };
  }

  async executeAfter(
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ): Promise<void> {

    const rules = this.getRulesForTrigger(table, `after_${action}`);

    for (const rule of rules) {
      if (!this.evaluateCondition(rule.condition, data)) continue;

      for (const action of rule.actions) {
        if (action.type === 'webhook') {
          await fetch(action.url, {
            method: action.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, action, data, rule: rule.name })
          });
        }
        if (action.type === 'create_record') {
          // 在另一張表建記錄
        }
        if (action.type === 'notify') {
          // 記 log 或呼叫 webhook
        }
      }
    }
  }
}
```

### 整合到 CRUD API

```typescript
// server/src/index.ts
app.post('/api/data/:table', async (req, res) => {
  // 1. before rules
  const beforeResult = await ruleEngine.executeBefore(table, 'insert', req.body);
  if (!beforeResult.allowed) {
    return res.status(400).json({ errors: beforeResult.errors });
  }

  // 2. 實際寫入 DB（用 beforeResult.data，可能被 set_field 修改過）
  const created = insertRow(table, beforeResult.data);

  // 3. after rules（非阻塞）
  ruleEngine.executeAfter(table, 'insert', created).catch(console.error);

  res.json(created);
});
```

### 對話→動作 範例

```
使用者：「VIP 客戶下單自動打 9 折」

Orchestrator → manage_rules({
  action: 'create_rule',
  rule: {
    name: 'VIP 自動折扣',
    description: 'VIP 客戶的訂單自動打 9 折',
    table_name: 'orders',
    trigger_type: 'before_insert',
    condition: { field: 'customer_tier', operator: 'eq', value: 'vip' },
    actions: [
      { type: 'set_field', field: 'discount', value: '0.1' },
      { type: 'set_field', field: 'final_amount', value: 'total_amount * 0.9' }
    ]
  }
})
```

---

## 4.5 Test Agent

### Tool 定義

```typescript
{
  name: 'assess_impact',
  input_schema: {
    properties: {
      table_name: { type: 'string' },
      change_type: { enum: ['drop_column', 'rename_column', 'change_type', 'drop_table'] },
      details: { type: 'object' }
    }
  }
}
```

### 實作

```typescript
// server/src/agents/test-agent.ts
export function assessImpact(input: AssessInput): AgentResult {
  const { table_name, change_type, details } = input;

  // 1. 查受影響的 views
  const views = getAllViews().filter(v => {
    const def = JSON.parse(v.definition);
    return def.table_name === table_name
      || def.detail_views?.some(d => d.table_name === table_name);
  });

  // 2. 查受影響的 rules
  const rules = db.prepare(
    'SELECT * FROM _zenku_rules WHERE table_name = ?'
  ).all(table_name);

  // 3. 查受影響的資料筆數
  const rowCount = db.prepare(
    `SELECT COUNT(*) as count FROM "${table_name}"`
  ).get();

  // 4. 查引用此表的其他表（外鍵）
  const referencing = findReferencingTables(table_name);

  return {
    success: true,
    message: formatImpactReport({ views, rules, rowCount, referencing, change_type, details }),
    data: { views: views.length, rules: rules.length, rows: rowCount.count, referencing }
  };
}

function formatImpactReport(info): string {
  return `⚠️ 影響評估：
- 受影響的介面：${info.views} 個
- 受影響的規則：${info.rules} 個
- 受影響的資料：${info.rows} 筆
${info.referencing.length > 0 ? `- 被引用的表：${info.referencing.join(', ')}` : ''}
建議${info.rows > 100 ? '謹慎操作' : '可以執行'}，是否繼續？`;
}
```

---

## 新增依賴

```bash
npm install multer @types/multer   # 檔案上傳
npm install uuid                    # 檔案 ID 生成
```

---

## 新增檔案

```
server/src/agents/file-agent.ts
server/src/agents/logic-agent.ts
server/src/agents/test-agent.ts
server/src/tools/file-tools.ts
server/src/tools/rule-tools.ts
server/src/engine/rule-engine.ts
server/src/middleware/permission.ts

web/src/components/fields/ImageField.tsx
web/src/components/fields/FileField.tsx
```

---

## 驗收標準

- [ ] 上傳 CSV → AI 自動建表 + 匯入資料 + 建 UI
- [ ] 「VIP 客戶下單打 9 折」→ 自動建 rule，新增訂單時自動套用
- [ ] 破壞性 schema 變更 → 先顯示影響評估 → 使用者確認後才執行
- [ ] user 角色無法使用 manage_schema（被拒絕並提示）
- [ ] Webhook rule → 觸發後正確呼叫外部 URL
