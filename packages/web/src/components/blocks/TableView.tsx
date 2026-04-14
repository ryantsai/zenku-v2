import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { ViewDefinition } from '../../types';
import { FormView } from './FormView';

interface Props {
  view: ViewDefinition;
  rows: Record<string, unknown>[];
  onRefresh: () => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: unknown, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: unknown) => Promise<void>;
}

export function TableView({ view, rows, onRefresh, onCreate, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);

  const handleCreate = async (data: Record<string, unknown>) => {
    await onCreate(data);
    setShowForm(false);
    onRefresh();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingRow) return;
    await onUpdate(editingRow.id, data);
    setEditingRow(null);
    onRefresh();
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    if (!confirm('確定刪除這筆資料？')) return;
    await onDelete(row.id);
    onRefresh();
  };

  const canCreate = view.actions.includes('create');
  const canEdit = view.actions.includes('edit');
  const canDelete = view.actions.includes('delete');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">{view.name}</h2>
        {canCreate && (
          <button
            onClick={() => { setShowForm(true); setEditingRow(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} />
            新增
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            目前沒有資料，點擊「新增」開始建立
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {view.columns.map(col => (
                  <th key={col.key} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {col.label}
                  </th>
                ))}
                {(canEdit || canDelete) && (
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {view.columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-gray-700">
                      <CellValue value={row[col.key]} type={col.type} />
                    </td>
                  ))}
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            onClick={() => { setEditingRow(row); setShowForm(false); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(row)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <Modal title={`新增${view.name}`} onClose={() => setShowForm(false)}>
          <FormView fields={view.form.fields} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {/* Edit Form Modal */}
      {editingRow && (
        <Modal title={`編輯${view.name}`} onClose={() => setEditingRow(null)}>
          <FormView
            fields={view.form.fields}
            initialValues={editingRow}
            onSubmit={handleUpdate}
            onCancel={() => setEditingRow(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function CellValue({ value, type }: { value: unknown; type: string }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  if (type === 'boolean') return <span>{value ? '✓' : '✗'}</span>;
  return <span>{String(value)}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
