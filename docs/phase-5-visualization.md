# Phase 5：視覺化與報表

> **目標：** 讓資料不只是表格，能用圖表、看板、行事曆呈現。
> **建議模型：Sonnet**（圖表元件整合，模式明確）

---

## 5.1 新增 View 類型

| 類型 | 用途 | 前端元件 |
|------|------|----------|
| `table` | 列表（現有） | TableView |
| `master-detail` | 主檔+明細（Phase 3） | MasterDetailView |
| `dashboard` | 統計面板 | DashboardView |
| `kanban` | 看板 | KanbanView |
| `calendar` | 行事曆 | CalendarView |

---

## 5.2 Dashboard

### 新增依賴

```bash
npm install recharts
```

### DashboardView 元件

```
components/blocks/DashboardView.tsx
```

```tsx
function DashboardView({ view }: { view: ViewDefinition }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">{view.name}</h2>
      <div className="grid grid-cols-12 gap-4">
        {view.widgets?.map(widget => (
          <div
            key={widget.id}
            className={gridClass(widget.size)}
            style={{ gridRow: `span ${widget.position.rowSpan ?? 1}` }}
          >
            <WidgetRenderer widget={widget} />
          </div>
        ))}
      </div>
    </div>
  );
}

function gridClass(size: string) {
  switch (size) {
    case 'sm':   return 'col-span-3';
    case 'md':   return 'col-span-6';
    case 'lg':   return 'col-span-9';
    case 'full': return 'col-span-12';
  }
}
```

### Widget 元件

```tsx
function WidgetRenderer({ widget }: { widget: DashboardWidget }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // POST /api/query { sql: widget.query }
    queryApi(widget.query).then(d => { setData(d); setLoading(false); });
  }, [widget.query]);

  if (loading) return <Skeleton />;

  switch (widget.type) {
    case 'stat_card':    return <StatCard data={data} title={widget.title} />;
    case 'bar_chart':    return <BarChartWidget data={data} title={widget.title} config={widget.config} />;
    case 'line_chart':   return <LineChartWidget data={data} title={widget.title} config={widget.config} />;
    case 'pie_chart':    return <PieChartWidget data={data} title={widget.title} config={widget.config} />;
    case 'mini_table':   return <MiniTableWidget data={data} title={widget.title} />;
  }
}
```

### StatCard

```tsx
function StatCard({ data, title }) {
  // data = [{ value: 42 }]
  const value = data?.[0]?.value ?? 0;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
```

### 圖表 Widget（Recharts）

```tsx
function BarChartWidget({ data, title, config }) {
  // config: { x_key: 'month', y_key: 'count', color: '#6366f1' }
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey={config?.x_key ?? 'label'} />
            <YAxis />
            <Bar dataKey={config?.y_key ?? 'value'} fill={config?.color ?? '#6366f1'} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### 後端：通用查詢 API

```typescript
// server/src/index.ts
app.post('/api/query', (req, res) => {
  const { sql } = req.body;
  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    return res.status(400).json({ error: '只允許 SELECT' });
  }

  const db = getDb();
  const rows = db.prepare(sql + ' LIMIT 1000').all(); // 安全限制
  res.json(rows);
});
```

### 對話→動作 範例

```
使用者：「我想看客戶統計面板」

Orchestrator → manage_ui({
  action: 'create_view',
  view: {
    id: 'customer_dashboard',
    name: '客戶統計',
    table_name: 'customers',
    type: 'dashboard',
    widgets: [
      {
        id: 'total',
        type: 'stat_card',
        title: '客戶總數',
        query: 'SELECT COUNT(*) as value FROM customers',
        size: 'sm',
        position: { row: 0, col: 0 }
      },
      {
        id: 'vip_count',
        type: 'stat_card',
        title: 'VIP 客戶',
        query: "SELECT COUNT(*) as value FROM customers WHERE level = 'VIP'",
        size: 'sm',
        position: { row: 0, col: 1 }
      },
      {
        id: 'level_dist',
        type: 'pie_chart',
        title: '客戶等級分佈',
        query: "SELECT level as label, COUNT(*) as value FROM customers GROUP BY level",
        size: 'md',
        position: { row: 0, col: 2 },
        config: { label_key: 'label', value_key: 'value' }
      },
      {
        id: 'monthly_trend',
        type: 'line_chart',
        title: '每月新增客戶',
        query: "SELECT strftime('%Y-%m', created_at) as label, COUNT(*) as value FROM customers GROUP BY label ORDER BY label",
        size: 'lg',
        position: { row: 1, col: 0 },
        config: { x_key: 'label', y_key: 'value' }
      }
    ]
  }
})
```

---

## 5.3 Kanban

### 新增依賴

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

### KanbanView 元件

```
components/blocks/KanbanView.tsx
```

```tsx
function KanbanView({ view, rows, onUpdate }: Props) {
  const { group_field, title_field, description_field } = view.kanban!;

  // 取得分組欄位的所有可能值（從 view.form 的 options 或 source）
  const groups = getFieldOptions(view, group_field);

  // 按分組欄位分組資料
  const grouped = groupBy(rows, group_field);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {groups.map(group => (
          <KanbanColumn
            key={group}
            title={group}
            items={grouped[group] ?? []}
            titleField={title_field}
            descField={description_field}
          />
        ))}
      </div>
    </DndContext>
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    // 拖曳到不同 column = 更新 group_field 的值
    const newGroup = over.data.current?.group;
    onUpdate(active.id, { [group_field]: newGroup });
  }
}
```

### 對話→動作 範例

```
使用者：「用看板方式管理任務」

Orchestrator → manage_ui({
  action: 'create_view',
  view: {
    id: 'tasks_kanban',
    name: '任務看板',
    table_name: 'tasks',
    type: 'kanban',
    kanban: {
      group_field: 'status',
      title_field: 'title',
      description_field: 'description'
    },
    // columns, form 照常定義（切回列表模式時使用）
  }
})
```

---

## 5.4 Calendar

### 新增依賴

考慮輕量方案，自己做月曆 grid，或用 `@fullcalendar/react`。

### CalendarView 元件（簡易版）

```tsx
function CalendarView({ view, rows }: Props) {
  const { date_field, title_field, color_field } = view.calendar!;

  // 月曆 grid：7 欄 × 5~6 行
  // 每格顯示該天的事件
  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200">
      {daysInMonth.map(day => (
        <CalendarCell
          key={day}
          date={day}
          events={rows.filter(r => isSameDay(r[date_field], day))}
          titleField={title_field}
          colorField={color_field}
        />
      ))}
    </div>
  );
}
```

---

## AppArea 路由判斷

```tsx
function AppArea({ view }) {
  switch (view.type) {
    case 'table':         return <TableView ... />;
    case 'master-detail': return <MasterDetailView ... />;
    case 'dashboard':     return <DashboardView ... />;
    case 'kanban':        return <KanbanView ... />;
    case 'calendar':      return <CalendarView ... />;
  }
}
```

---

## Sidebar 圖示

```tsx
// 不同 view type 不同圖示
const VIEW_ICONS: Record<ViewType, LucideIcon> = {
  table: TableIcon,
  'master-detail': FileText,
  dashboard: BarChart3,
  kanban: Columns,
  calendar: Calendar,
};
```

---

## manage_ui Tool 擴充

`view.type` 的 enum 擴展：

```typescript
type: { type: 'string', enum: ['table', 'master-detail', 'dashboard', 'kanban', 'calendar'] }
```

新增 `widgets`、`kanban`、`calendar` 的 schema 定義到 tool input_schema。

---

## Orchestrator Prompt 更新

```
介面類型選擇指南：
- 一般資料管理 → type: 'table'
- 主檔+明細 → type: 'master-detail'
- 統計/報表 → type: 'dashboard'
- 狀態流轉/任務管理 → type: 'kanban'
- 日程/排程 → type: 'calendar'

使用者說「我想看...的趨勢/統計/分佈」→ dashboard
使用者說「用看板/卡片」→ kanban
使用者說「行事曆/排程」→ calendar
```

---

## 新增檔案

```
web/src/components/blocks/DashboardView.tsx
web/src/components/blocks/KanbanView.tsx
web/src/components/blocks/CalendarView.tsx
web/src/components/blocks/widgets/
├── StatCard.tsx
├── BarChartWidget.tsx
├── LineChartWidget.tsx
├── PieChartWidget.tsx
└── MiniTableWidget.tsx
```

---

## 驗收標準

- [ ] 「看客戶統計」→ 生成 dashboard 含 stat cards + 圖表
- [ ] Dashboard 圖表正確渲染（bar, line, pie）
- [ ] 「用看板管理任務」→ kanban view，拖曳更新狀態
- [ ] 「行事曆顯示排程」→ calendar view
- [ ] 暗色模式下圖表正常顯示
