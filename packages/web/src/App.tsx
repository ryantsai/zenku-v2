import { useState, useEffect, useCallback } from 'react';
import { getViews } from './api';
import type { ViewDefinition } from './types';
import { Sidebar } from './components/Sidebar';
import { AppArea } from './components/AppArea';
import { ChatPanel } from './components/ChatPanel';

export default function App() {
  const [views, setViews] = useState<ViewDefinition[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const fetchViews = useCallback(async () => {
    const data = await getViews();
    const defs = data.map(d => d.definition);
    setViews(defs);
    // 如果目前沒有選中的 view，或者選中的 view 被刪除，自動選第一個
    if (defs.length > 0) {
      setActiveViewId(prev => prev && defs.find(v => v.id === prev) ? prev : defs[0].id);
    }
  }, []);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const activeView = views.find(v => v.id === activeViewId) ?? null;
  const hasViews = views.length > 0;

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar — 只有有 views 才顯示 */}
      {hasViews && (
        <Sidebar
          views={views}
          activeViewId={activeViewId}
          onSelect={setActiveViewId}
        />
      )}

      {/* App Area */}
      <AppArea view={activeView} />

      {/* Chat Panel */}
      <div className={`flex flex-col ${hasViews ? 'w-80' : 'w-full max-w-lg mx-auto my-auto h-[600px] rounded-xl shadow-xl overflow-hidden'}`}>
        <ChatPanel onViewsChanged={fetchViews} />
      </div>
    </div>
  );
}
