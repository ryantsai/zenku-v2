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

  let definitionStr: string | undefined = views.find(v => v.table_name === tableName)?.definition;
  if (!definitionStr) {
    for (const v of views) {
      try {
        const def = JSON.parse(v.definition) as { detail_views?: { table_name: string; view: unknown }[] };
        const dv = def.detail_views?.find(d => d.table_name === tableName);
        if (dv) { definitionStr = JSON.stringify(dv.view); break; }
      } catch { continue; }
    }
  }
  if (!definitionStr) return [];

  try {
    type ColDef = { key: string; type: string; relation?: { table: string; display_field: string; value_field?: string } };
    const def = JSON.parse(definitionStr) as { columns?: ColDef[] };
    return (def.columns ?? [])
      .filter(c => c.type === 'relation' && c.relation?.table && c.relation?.display_field)
      .map(c => ({
        key: c.key,
        relation: {
          table: c.relation!.table,
          display_field: c.relation!.display_field,
          value_field: c.relation!.value_field ?? 'id',
        }
      }));
  } catch { return []; }
}
