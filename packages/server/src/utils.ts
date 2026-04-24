import { getAllViews } from './db/views';

export function isSafeFieldName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

export function p(v: string | string[] | undefined): string {
  if (v === undefined) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

export async function getMultiselectColumns(tableName: string): Promise<string[]> {
  const views = await getAllViews();
  const found: string[] = [];
  for (const v of views) {
    try {
      const def = JSON.parse(v.definition) as {
        table_name?: string;
        form?: { fields?: { key: string; type: string }[] };
        detail_views?: { table_name: string; view: { form?: { fields?: { key: string; type: string }[] } } }[];
      };
      let fields: { key: string; type: string }[] = [];
      if (def.table_name === tableName) {
        fields = def.form?.fields ?? [];
      } else if (def.detail_views) {
        const detail = def.detail_views.find(dv => dv.table_name === tableName);
        if (detail) fields = detail.view.form?.fields ?? [];
      }
      for (const f of fields) {
        if (f.type === 'multiselect' && !found.includes(f.key)) found.push(f.key);
      }
    } catch { continue; }
  }
  return found;
}

export interface RelationColumnDef {
  key: string;
  relation: { table: string; display_field: string; value_field: string };
}

export async function getRelationColumns(tableName: string): Promise<RelationColumnDef[]> {
  const views = await getAllViews();
  let view = views.find(v => v.table_name === tableName);
  if (!view) {
    for (const v of views) {
      try {
        const def = JSON.parse(v.definition) as { detail_views?: { table_name: string; view: { columns?: unknown[] } }[] };
        if (def.detail_views) {
          const detailView = def.detail_views.find(dv => dv.table_name === tableName);
          if (detailView) { view = { definition: JSON.stringify(detailView.view) } as any; break; }
        }
      } catch { continue; }
    }
  }
  if (!view) return [];
  try {
    const def = JSON.parse(view.definition) as { columns?: { key: string; type: string; relation?: { table: string; display_field: string } }[] };
    return (def.columns ?? [])
      .filter(c => (c as any).type === 'relation' && (c as any).relation?.table && (c as any).relation?.display_field)
      .map(c => ({
        key: c.key,
        relation: {
          table: (c as any).relation!.table,
          display_field: (c as any).relation!.display_field,
          value_field: (c as any).relation!.value_field ?? 'id',
        }
      }));
  } catch { return []; }
}
