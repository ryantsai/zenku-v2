import { Database } from 'lucide-react';
import type { ViewDefinition } from '../types';

interface Props {
  views: ViewDefinition[];
  activeViewId: string | null;
  onSelect: (viewId: string) => void;
}

export function Sidebar({ views, activeViewId, onSelect }: Props) {
  return (
    <aside className="w-52 bg-gray-900 text-gray-300 flex flex-col">
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center text-white text-xs font-bold">禪</div>
          <span className="font-semibold text-white text-sm">Zenku</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {views.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500">
            尚無頁面
          </div>
        ) : (
          views.map(view => (
            <button
              key={view.id}
              onClick={() => onSelect(view.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                activeViewId === view.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Database size={14} className="shrink-0" />
              <span className="truncate">{view.name}</span>
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
