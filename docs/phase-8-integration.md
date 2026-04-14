# Phase 8：外部整合 + 多 AI Provider + 對話歷程 + 部署

> **目標：** n8n/Webhook 整合、多 AI 供應商支援、對話審計/偵錯、容器化部署。
> **建議模型：Opus 做 AI Provider 抽象層設計 → Sonnet 實作其餘**

---

## 8.1 多 AI Provider 支援

### 架構：Provider 抽象層

```
server/src/ai/
├── provider.ts          # 抽象介面
├── claude-provider.ts   # Claude 實作
├── openai-provider.ts   # OpenAI 實作
├── gemini-provider.ts   # Gemini 實作
└── index.ts             # factory
```

### 抽象介面

```typescript
// server/src/ai/provider.ts
import type { LLMMessage, LLMResponse, ToolCall, TokenUsage } from '@zenku/shared';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

export interface AIProvider {
  readonly name: string;

  chat(params: {
    model: string;
    system: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse>;
}
```

### Claude Provider

```typescript
// server/src/ai/claude-provider.ts
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(params): Promise<LLMResponse> {
    const startTime = Date.now();

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      tools: params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      messages: this.convertMessages(params.messages),
    });

    return {
      content: response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join(''),
      tool_calls: response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> })),
      stop_reason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      latency_ms: Date.now() - startTime,
    };
  }

  private convertMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    // LLMMessage → Anthropic format 轉換
  }
}
```

### OpenAI Provider

```typescript
// server/src/ai/openai-provider.ts
import OpenAI from 'openai';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(params): Promise<LLMResponse> {
    const startTime = Date.now();

    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: params.system },
        ...this.convertMessages(params.messages),
      ],
      tools: params.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      })),
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content ?? '',
      tool_calls: (choice.message.tool_calls ?? []).map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      })),
      stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      },
      latency_ms: Date.now() - startTime,
    };
  }
}
```

### Gemini Provider

```typescript
// server/src/ai/gemini-provider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(params): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = this.client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.system,
      tools: [{
        functionDeclarations: params.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }))
      }],
    });

    const result = await model.generateContent({
      contents: this.convertMessages(params.messages),
    });

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts ?? [];

    return {
      content: parts.filter(p => p.text).map(p => p.text).join(''),
      tool_calls: parts
        .filter(p => p.functionCall)
        .map((p, i) => ({
          id: `gemini-${i}`,
          name: p.functionCall!.name,
          input: p.functionCall!.args as Record<string, unknown>,
        })),
      stop_reason: parts.some(p => p.functionCall) ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      latency_ms: Date.now() - startTime,
    };
  }
}
```

### Provider Factory

```typescript
// server/src/ai/index.ts
export function createProvider(provider: AIProvider): AIProvider {
  switch (provider) {
    case 'claude':
      return new ClaudeProvider(process.env.ANTHROPIC_API_KEY!);
    case 'openai':
      return new OpenAIProvider(process.env.OPENAI_API_KEY!);
    case 'gemini':
      return new GeminiProvider(process.env.GEMINI_API_KEY!);
  }
}
```

### .env 擴充

```env
# AI Providers（至少設一個）
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# 預設 provider 和 model
DEFAULT_AI_PROVIDER=claude
DEFAULT_AI_MODEL=claude-sonnet-4-6
```

### Orchestrator 修改

```typescript
// orchestrator.ts — 改用抽象層
export async function* chat(
  userMessage: string,
  history: LLMMessage[],
  options?: { provider?: string; model?: string }
): AsyncGenerator<string> {

  const providerName = options?.provider ?? process.env.DEFAULT_AI_PROVIDER ?? 'claude';
  const model = options?.model ?? process.env.DEFAULT_AI_MODEL ?? 'claude-sonnet-4-6';
  const provider = createProvider(providerName as AIProviderType);

  // ... 使用 provider.chat() 取代 client.messages.create()
}
```

### 前端：Provider 選擇器

```tsx
// ChatPanel header 加入 provider/model 選擇
<Select value={provider} onValueChange={setProvider}>
  <SelectItem value="claude">Claude</SelectItem>
  <SelectItem value="openai">OpenAI</SelectItem>
  <SelectItem value="gemini">Gemini</SelectItem>
</Select>
<Select value={model} onValueChange={setModel}>
  {AI_MODELS[provider].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
</Select>
```

---

## 8.2 對話歷程管理

### 系統表

```sql
-- 對話 session
CREATE TABLE _zenku_chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES _zenku_users(id),
  title TEXT,                        -- 自動產生（首句訊息摘要）
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_thinking_tokens INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0
);

-- 對話訊息
CREATE TABLE _zenku_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES _zenku_chat_sessions(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,                -- 'user' | 'assistant'
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  thinking_tokens INTEGER DEFAULT 0,
  thinking_content TEXT,             -- 思考鏈原文
  latency_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 工具使用記錄
CREATE TABLE _zenku_tool_events (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES _zenku_chat_messages(id),
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input TEXT,                   -- JSON
  tool_output TEXT,                  -- JSON
  success BOOLEAN,
  started_at TEXT,
  finished_at TEXT,
  latency_ms INTEGER DEFAULT 0
);

CREATE INDEX idx_messages_session ON _zenku_chat_messages(session_id);
CREATE INDEX idx_tool_events_session ON _zenku_tool_events(session_id);
CREATE INDEX idx_tool_events_message ON _zenku_tool_events(message_id);
```

### 記錄流程

```typescript
// orchestrator.ts — 每次 chat 呼叫時記錄

// 1. 建立或取得 session
const sessionId = getOrCreateSession(userId, provider, model);

// 2. 記錄使用者訊息
recordMessage({
  session_id: sessionId,
  user_id: userId,
  role: 'user',
  content: userMessage,
});

// 3. 每次 LLM 回應後記錄
const response = await provider.chat(...);
const msgId = recordMessage({
  session_id: sessionId,
  user_id: userId,
  role: 'assistant',
  content: response.content,
  provider: providerName,
  model: model,
  input_tokens: response.usage.input_tokens,
  output_tokens: response.usage.output_tokens,
  thinking_tokens: response.usage.thinking_tokens ?? 0,
  thinking_content: response.thinking ?? null,
  latency_ms: response.latency_ms,
});

// 4. 每次 tool 執行後記錄
recordToolEvent({
  message_id: msgId,
  session_id: sessionId,
  agent: toolToAgent(toolName),
  tool_name: toolName,
  tool_input: toolInput,
  tool_output: result,
  success: result.success,
  latency_ms: toolLatency,
});

// 5. 更新 session 統計
updateSessionStats(sessionId, response.usage);
```

### SSE 串流擴充

```typescript
// 回傳 usage 資訊給前端
yield JSON.stringify({
  type: 'usage',
  usage: response.usage,
  latency_ms: response.latency_ms
}) + '\n';

// 如果有 thinking，也回傳
if (response.thinking) {
  yield JSON.stringify({
    type: 'thinking',
    content: response.thinking
  }) + '\n';
}
```

---

## 8.3 管理者 — 對話歷程 UI

### API

```typescript
// Admin only
app.get('/api/admin/sessions', requireAdmin, (req, res) => {
  const { page = 1, limit = 20, user_id, provider } = req.query;
  // 列出所有 sessions，可按使用者和 provider 篩選
  // 回傳含 user name、message_count、token 使用量
});

app.get('/api/admin/sessions/:id', requireAdmin, (req, res) => {
  // 取得 session 的所有訊息 + tool events
  // 組成完整對話時間線
});

app.get('/api/admin/usage', requireAdmin, (req, res) => {
  const { period = 'daily', from, to } = req.query;
  // 統計 token 用量、花費、按 provider/user/agent 分組
});
```

### 前端管理頁面

```
components/admin/
├── ChatHistory.tsx         # 對話歷程列表
├── SessionDetail.tsx       # 單一 session 詳情（完整對話+工具+思考鏈）
└── UsageStats.tsx          # 用量統計儀表板
```

### ChatHistory 頁面

```tsx
function ChatHistory() {
  // 表格：Session ID | 使用者 | Provider/Model | 訊息數 | Tokens | 花費 | 時間
  // 可篩選：使用者、Provider、時間範圍
  // 點擊 → SessionDetail
}
```

### SessionDetail 頁面

```tsx
function SessionDetail({ sessionId }) {
  // 時間線格式：
  //
  // [14:32:01] 使用者：「我要管理客戶資料」
  //
  // [14:32:05] AI (claude-sonnet-4-6)
  //   ├── 思考鏈：（可展開）
  //   │   「使用者需要一個客戶管理系統...」
  //   ├── Tool: manage_schema
  //   │   Input: { action: 'create_table', table_name: 'customers', ... }
  //   │   Output: { success: true, message: '已建立表 customers' }
  //   │   延遲: 45ms
  //   ├── Tool: manage_ui
  //   │   Input: { ... }
  //   │   Output: { success: true }
  //   │   延遲: 12ms
  //   ├── 回覆：「已建立客戶管理...」
  //   └── Token: 1,234 in / 567 out / 89 thinking | 3.2s | $0.008
}
```

### UsageStats 頁面

```tsx
function UsageStats() {
  // 統計卡片：
  //   總花費 | 總 Token | 總 Sessions | 總 Messages
  //
  // 圖表：
  //   每日 token 用量趨勢（折線圖）
  //   Provider 分佈（圓餅圖）
  //   使用者排行（柱狀圖）
  //   Agent 呼叫次數 + 平均延遲（表格）
  //   錯誤率（Agent 失敗次數 / 總呼叫次數）
}
```

### 費用估算

```typescript
// @zenku/shared/types/ai-provider.ts
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  // 每 1M tokens 的 USD 價格
  'claude-sonnet-4-6':        { input: 3,   output: 15  },
  'claude-haiku-4-5-20251001':{ input: 0.8, output: 4   },
  'claude-opus-4-6':          { input: 15,  output: 75  },
  'gpt-4o':                   { input: 2.5, output: 10  },
  'gpt-4o-mini':              { input: 0.15,output: 0.6 },
  'gemini-2.5-flash':         { input: 0.15,output: 0.6 },
  'gemini-2.5-pro':           { input: 1.25,output: 10  },
};

export function estimateCost(model: string, usage: TokenUsage): number {
  const cost = TOKEN_COSTS[model];
  if (!cost) return 0;
  return (usage.input_tokens * cost.input + usage.output_tokens * cost.output) / 1_000_000;
}
```

---

## 8.4 Webhook / n8n 整合

### 觸發流程

```
Zenku Rule (after_insert)
    ↓
RuleEngine: action.type === 'webhook'
    ↓
POST {action.url}
  Headers: { 'Content-Type': 'application/json', 'X-Zenku-Signature': hmac }
  Body: {
    event: 'after_insert',
    table: 'orders',
    data: { id: 1, customer_id: 3, total: 15000, ... },
    rule: { id: '...', name: 'VIP 通知' },
    timestamp: '2026-04-13T10:30:00Z'
  }
    ↓
n8n 接收 → 處理（發 Slack、寄 Email、呼叫 ERP...）
    ↓
n8n 回呼 Zenku
    ↓
POST /api/webhook/callback
  Body: { table: 'orders', record_id: 1, updates: { status: '已通知' } }
```

### Webhook 回呼 API

```typescript
// server/src/index.ts
app.post('/api/webhook/callback', authenticateWebhook, (req, res) => {
  const { table, record_id, updates } = req.body;

  // 驗證 webhook secret
  // 更新指定記錄
  const db = getDb();
  const keys = Object.keys(updates);
  const setClause = keys.map(k => `"${k}" = ?`).join(', ');
  db.prepare(`UPDATE "${table}" SET ${setClause} WHERE id = ?`)
    .run(...Object.values(updates), record_id);

  // 記 journal
  writeJournal({
    agent: 'logic',
    type: 'rule_change',
    description: `Webhook 回呼更新 ${table} #${record_id}`,
    diff: { before: null, after: updates },
    user_request: 'webhook callback',
    reversible: false,
  });

  res.json({ success: true });
});

// Webhook 驗證
function authenticateWebhook(req, res, next) {
  const signature = req.headers['x-zenku-signature'];
  const expected = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(JSON.stringify(req.body)).digest('hex');
  if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' });
  next();
}
```

### .env 擴充

```env
WEBHOOK_SECRET=your-webhook-secret-here
```

---

## 8.5 部署

### Dockerfile

```dockerfile
FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci

COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/web packages/web
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/web/dist ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json .

# 靜態檔案由 Express serve
ENV NODE_ENV=production
EXPOSE 3001
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
services:
  zenku:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - zenku-data:/app/data
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DEFAULT_AI_PROVIDER=${DEFAULT_AI_PROVIDER:-claude}
      - DEFAULT_AI_MODEL=${DEFAULT_AI_MODEL:-claude-sonnet-4-6}
      - JWT_SECRET=${JWT_SECRET}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}

volumes:
  zenku-data:
```

### Production 路由

```typescript
// server/src/index.ts — production 時 serve 前端靜態檔
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}
```

---

## 新增依賴

```bash
# server
npm install openai @google/generative-ai   # AI providers
npm install -w packages/server

# 選用
npm install helmet compression              # production security
```

---

## 新增檔案

```
server/src/ai/
├── provider.ts
├── claude-provider.ts
├── openai-provider.ts
├── gemini-provider.ts
└── index.ts

web/src/components/admin/
├── ChatHistory.tsx
├── SessionDetail.tsx
└── UsageStats.tsx

Dockerfile
docker-compose.yml
```

---

## 驗收標準

- [x] 可在 ChatPanel 切換 Claude / OpenAI / Gemini
- [x] 三個 provider 都能正確執行 tool_use 迴圈
- [ ] 每次對話記錄 token 用量和延遲
- [ ] Admin 可以查看所有使用者的對話歷程（含思考鏈、工具使用）
- [ ] Admin 可以看到 token 花費統計（按 provider、使用者、時間）
- [ ] Webhook rule 觸發後正確呼叫外部 URL
- [ ] n8n 可以透過回呼 API 更新 Zenku 資料
- [ ] Docker build + run 正常
- [x] 環境變數正確注入

---

## 實作紀錄（2026-04-15）

### 8.1 AI Provider 抽象層 — 已完成

**架構設計（Opus）：**

```
server/src/ai/
├── types.ts            — ToolDefinition + AIProvider 介面
├── claude-provider.ts  — Anthropic SDK 實作
├── openai-provider.ts  — OpenAI SDK 實作
├── gemini-provider.ts  — Google Generative AI SDK 實作
└── index.ts            — Factory + 可用 provider 偵測
```

**核心設計：**
- `AIProvider.chat(ChatParams) → LLMResponse`：統一的 provider 介面
- `LLMMessage`（來自 @zenku/shared）作為 provider-agnostic 訊息格式
  - `role: 'assistant'` + `tool_calls` → 各 provider 轉為原生格式
  - `role: 'user'` + `tool_results` → 各 provider 轉為原生 tool result
- 每個 provider 實作 message 雙向轉換（to/from native format）
- Singleton cache：每個 provider name 只建一次實例
- `getAvailableProviders()` 偵測 env 中有哪些 API key 已設定

**Orchestrator 重構：**
- 移除 Anthropic SDK 直接依賴，改用 `AIProvider.chat()`
- `TOOLS` 改型別為 `ToolDefinition[]`（provider-agnostic，結構不變）
- 新增 `executeTool()` 抽取工具分發邏輯
- `chat()` 接受 `ChatOptions { provider?, model? }`

**前端：**
- `GET /api/ai/providers` → 可用 provider 清單
- ChatPanel：provider/model 雙下拉選擇器（>1 provider 時顯示）
- `sendChat()` 傳送 provider/model 到後端

### 待完成

- [ ] 8.2 對話歷程管理（_zenku_chat_sessions, _zenku_chat_messages, _zenku_tool_events）
- [ ] 8.3 管理者 — 對話歷程 UI（ChatHistory, SessionDetail, UsageStats）
- [ ] 8.4 Webhook / n8n 整合
- [ ] 8.5 部署（Dockerfile, docker-compose.yml）
