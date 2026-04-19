import { useParams } from 'react-router-dom';
import { useViews } from '../contexts/ViewsContext';
import { VIEW_REGISTRY } from './blocks/registry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function AppArea() {
  const { viewId, recordId } = useParams();
  const { views } = useViews();

  if (!viewId) return <EmptyState />;

  const view = views.find(v => v.id === viewId);
  if (!view) {
    if (views.length === 0) return null;
    return <EmptyState />;
  }

  const entry = VIEW_REGISTRY[view.type];
  if (!entry) return <EmptyState />;

  if (recordId === 'new' && entry.createComponent) {
    return <entry.createComponent view={view} />;
  }
  if (recordId && entry.detailComponent) {
    return <entry.detailComponent view={view} recordId={recordId} />;
  }
  return <entry.component view={view} />;
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No data views yet</CardTitle>
          <CardDescription>Enter your requirements in the chat panel on the right, and the system will automatically generate tables and UI.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">For example: I want to manage customer data with name, phone, and email.</CardContent>
      </Card>
    </div>
  );
}
