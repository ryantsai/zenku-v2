import { useParams } from 'react-router-dom';
import { useViews } from '../contexts/ViewsContext';
import { TableView } from './blocks/TableView';
import { MasterDetailView } from './blocks/MasterDetailView';
import { MasterDetailCreateView } from './blocks/MasterDetailCreateView';
import { DashboardView } from './blocks/DashboardView';
import { KanbanView } from './blocks/KanbanView';
import { CalendarView } from './blocks/CalendarView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function AppArea() {
  const { viewId, recordId } = useParams();
  const { views } = useViews();

  if (!viewId) {
    return <EmptyState />;
  }

  const view = views.find(v => v.id === viewId);

  if (!view) {
    if (views.length === 0) return null;
    return <EmptyState />;
  }

  switch (view.type) {
    case 'master-detail':
      if (recordId === 'new') return <MasterDetailCreateView view={view} />;
      if (recordId) return <MasterDetailView view={view} recordId={recordId} />;
      return <TableView view={view} />;

    case 'dashboard':
      return <DashboardView view={view} />;

    case 'kanban':
      return <KanbanView view={view} />;

    case 'calendar':
      return <CalendarView view={view} />;

    default:
      return <TableView view={view} />;
  }
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>尚未建立資料視圖</CardTitle>
          <CardDescription>先在右側聊天面板輸入需求，系統會自動產生資料表與介面。</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">例如：我要管理客戶資料，有姓名、電話、email。</CardContent>
      </Card>
    </div>
  );
}
