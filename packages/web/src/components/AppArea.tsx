import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import type { ViewDefinition } from '../types';
import { getTableData, createRow, updateRow, deleteRow } from '../api';
import { TableView } from './blocks/TableView';

interface Props {
  view: ViewDefinition | null;
}

export function AppArea({ view }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!view) return;
    setLoading(true);
    try {
      const data = await getTableData(view.table_name);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    setRows([]);
    fetchData();
  }, [fetchData]);

  if (!view) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">禪</div>
          <p className="text-sm">在右側對話框描述你想要的功能</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-white">
      <TableView
        view={view}
        rows={rows}
        onRefresh={fetchData}
        onCreate={async data => { await createRow(view.table_name, data); }}
        onUpdate={async (id, data) => { await updateRow(view.table_name, id, data); }}
        onDelete={id => deleteRow(view.table_name, id)}
      />
    </div>
  );
}
