import type { FieldType } from './field';
import type { AppearanceRule } from './appearance';

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
  /** 在列表中隱藏此欄（仍保留定義，可於介面管理中切換） */
  hidden_in_table?: boolean;

  /** 條件外觀規則（表格每列依資料動態套用樣式） */
  appearance?: AppearanceRule[];
}
