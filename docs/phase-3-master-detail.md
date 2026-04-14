# Phase 3：Master-Detail 介面

> **目標：** 支援「訂單 + 訂單明細」、「採購單 + 採購明細」等一對多場景。
> **依賴：** Phase 2（關聯欄位、計算欄位）
> **建議模型：Sonnet**（UI 密集，模式清晰）

---

## 概念

```
┌─ MasterDetailView ──────────────────────────────┐
│                                                   │
│  ┌─ 主檔表單 ─────────────────────────────────┐  │
│  │  訂單編號: ORD-001     狀態: [已確認 ▼]     │  │
│  │  客戶: [張三 ▼]        日期: 2026-04-12     │  │
│  │  備註: ...              總金額: $15,000      │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌─ [訂單明細] ─┬─ [附件] ──────────────────┐  │
│  │               │                           │  │
│  │  品名    數量  單價    小計                │  │
│  │  ──────────────────────────               │  │
│  │  螢幕     2   $5,000  $10,000             │  │
│  │  鍵盤     5   $1,000  $5,000              │  │
│  │                                           │  │
│  │              [+ 新增明細]                  │  │
│  └───────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

---

## View Schema 擴充

```typescript
// @zenku/shared/types/view.ts 已定義
interface ViewDefinition {
  type: 'table' | 'master-detail';  // 新增 master-detail

  // master-detail 專用
  detail_views?: DetailViewDef[];
}

interface DetailViewDef {
  table_name: string;       // 明細表名
  foreign_key: string;      // 明細表中指向主表的外鍵欄位
  tab_label: string;        // Tab 標籤名
  view: ViewDefinition;     // 明細的 view 定義（遞迴，type='table'）
}
```

### AI 生成範例

```
使用者：「建立訂單管理，每張訂單有多筆明細，明細包含產品、數量、單價」

Orchestrator 呼叫：
1. manage_schema → 建 orders 表
2. manage_schema → 建 order_items 表（含 order_id REFERENCES orders）
3. manage_ui → 建 master-detail view：

{
  id: 'orders',
  name: '訂單管理',
  table_name: 'orders',
  type: 'master-detail',
  columns: [...],
  form: { fields: [...] },
  actions: ['create', 'edit', 'delete'],
  detail_views: [{
    table_name: 'order_items',
    foreign_key: 'order_id',
    tab_label: '訂單明細',
    view: {
      id: 'order_items',
      name: '訂單明細',
      table_name: 'order_items',
      type: 'table',
      columns: [
        { key: 'product_name', label: '品名', type: 'text' },
        { key: 'quantity', label: '數量', type: 'number' },
        { key: 'unit_price', label: '單價', type: 'currency' },
        { key: 'subtotal', label: '小計', type: 'currency' }
      ],
      form: { fields: [
        { key: 'product_name', label: '品名', type: 'text', required: true },
        { key: 'quantity', label: '數量', type: 'number', required: true },
        { key: 'unit_price', label: '單價', type: 'currency', required: true },
        { key: 'subtotal', label: '小計', type: 'currency',
          computed: { formula: 'quantity * unit_price', dependencies: ['quantity', 'unit_price'] },
          hidden_in_form: false
        }
      ]},
      actions: ['create', 'edit', 'delete']
    }
  }]
}
```

---

## 前端路由

### 新增依賴

```bash
npm install react-router-dom
```

### 路由設計

```tsx
// App.tsx
<Routes>
  <Route path="/" element={<AppShell />}>
    <Route path="view/:viewId" element={<AppArea />} />
    <Route path="view/:viewId/:recordId" element={<AppArea />} />  {/* master-detail */}
  </Route>
</Routes>
```

| URL | 行為 |
|-----|------|
| `/view/orders` | 訂單列表（TableView） |
| `/view/orders/3` | 訂單 #3 的 master-detail view |
| `/view/orders/new` | 新增訂單表單 |

### Sidebar 連結

```tsx
// Sidebar.tsx — 點擊時 navigate 到 /view/:viewId
<Link to={`/view/${view.id}`}>{view.name}</Link>
```

### TableView 行點擊

```tsx
// 如果 view.type === 'master-detail'，行點擊進入詳情
// 如果 view.type === 'table'，行點擊打開編輯 dialog（現有行為）
onClick={() => {
  if (view.type === 'master-detail') {
    navigate(`/view/${view.id}/${row.id}`);
  } else {
    setEditingRow(row);
  }
}}
```

---

## MasterDetailView 元件

```
components/blocks/MasterDetailView.tsx
```

### 架構

```tsx
function MasterDetailView({ view, recordId }: Props) {
  const [record, setRecord] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // 讀取主檔
  useEffect(() => {
    fetchRecord(view.table_name, recordId).then(setRecord);
  }, [recordId]);

  return (
    <div className="flex flex-col h-full">
      {/* 上半：主檔表單（唯讀模式，可切換編輯） */}
      <div className="border-b p-6">
        <FormView
          fields={view.form.fields}
          initialValues={record}
          mode="view"                    // 新增 view/edit mode
          onSave={handleUpdateMaster}
        />
      </div>

      {/* 下半：明細 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {view.detail_views?.map((dv, i) => (
            <TabsTrigger key={i} value={i}>{dv.tab_label}</TabsTrigger>
          ))}
        </TabsList>

        {view.detail_views?.map((dv, i) => (
          <TabsContent key={i} value={i}>
            <DetailTable
              view={dv.view}
              foreignKey={dv.foreign_key}
              masterRecordId={recordId}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

### DetailTable 元件

```tsx
// 就是 TableView，但自動篩選 + 新增時帶入 foreign key
function DetailTable({ view, foreignKey, masterRecordId }: Props) {
  // GET /api/data/order_items?filter[order_id]=3
  const rows = useTableData(view.table_name, { [foreignKey]: masterRecordId });

  return (
    <TableView
      view={view}
      rows={rows}
      onCreate={data => createRow(view.table_name, { ...data, [foreignKey]: masterRecordId })}
      // ...
    />
  );
}
```

---

## 後端 API 調整

### 篩選支援

```typescript
// GET /api/data/:table?filter[order_id]=3
app.get('/api/data/:table', (req, res) => {
  // 解析 filter 參數
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    const match = key.match(/^filter\[(\w+)\]$/);
    if (match) filters[match[1]] = value as string;
  }

  let where = '';
  const whereValues: unknown[] = [];
  if (Object.keys(filters).length > 0) {
    const clauses = Object.entries(filters).map(([k, v]) => {
      whereValues.push(v);
      return `"${k}" = ?`;
    });
    where = 'WHERE ' + clauses.join(' AND ');
  }
  // ... 接分頁排序
});
```

### 主檔總金額自動計算

```
觸發時機：明細表 INSERT/UPDATE/DELETE 後
方式一（Phase 4 Logic Agent）：建 rule
方式二（簡易版）：後端 middleware 在 order_items 變動後，
  UPDATE orders SET total = (SELECT SUM(subtotal) FROM order_items WHERE order_id = ?)
```

---

## FormView 擴充：view/edit 模式

```tsx
interface FormViewProps {
  mode?: 'create' | 'edit' | 'view';  // 新增 'view' 模式
}

// view 模式：欄位全部唯讀，右上角有「編輯」按鈕
// 點編輯切換為 edit 模式
```

---

## 新增檔案

| 檔案 | 用途 |
|------|------|
| `components/blocks/MasterDetailView.tsx` | 主檔+明細元件 |
| `hooks/useTableData.ts` | 通用資料取得 hook（含篩選） |

---

## Orchestrator Prompt 更新

```
建立一對多關係時：
1. 先建主表（如 orders）
2. 再建明細表（如 order_items），明細表需包含指向主表的外鍵（如 order_id INTEGER REFERENCES orders(id)）
3. UI 使用 type: 'master-detail'，並在 detail_views 定義明細的 view
```

---

## 驗收標準

- [ ] 「訂單有明細」→ AI 自動建兩張表 + master-detail view
- [ ] 訂單列表點擊 → 進入 master-detail 畫面
- [ ] 上半部顯示主檔資訊（可編輯）
- [ ] 下半部 Tab 顯示明細列表（可新增/編輯/刪除）
- [ ] 新增明細時自動帶入 order_id
- [ ] 返回列表（上一頁）
