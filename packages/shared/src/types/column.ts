import type { FieldType } from './field';

export interface ColumnDef {
  /** DB 欄位名 */
  key: string;
  /** 顯示名稱 */
  label: string;
  /** 欄位類型 */
  type: FieldType;
  /** 是否可排序 */
  sortable?: boolean;
  /** 欄寬（px） */
  width?: number;
  /** 關聯欄位顯示（列表用） */
  relation?: {
    table: string;
    display_field: string;
  };
}
