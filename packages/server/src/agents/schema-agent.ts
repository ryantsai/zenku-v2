import { createTable, alterTable, describeTables } from '../tools/db-tools';
import type { AgentResult } from '../types';

interface CreateTableInput {
  action: 'create_table';
  table_name: string;
  columns: {
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
  }[];
}

interface AlterTableInput {
  action: 'alter_table';
  table_name: string;
  changes: {
    operation: 'add_column';
    column: {
      name: string;
      type: string;
      required?: boolean;
      options?: string[];
    };
  }[];
}

interface DescribeInput {
  action: 'describe_tables';
}

type SchemaInput = CreateTableInput | AlterTableInput | DescribeInput;

export function runSchemaAgent(input: SchemaInput, userRequest: string): AgentResult {
  switch (input.action) {
    case 'create_table':
      return createTable(input.table_name, input.columns, userRequest);
    case 'alter_table':
      return alterTable(input.table_name, input.changes, userRequest);
    case 'describe_tables':
      return describeTables();
    default:
      return { success: false, message: '未知的 schema 操作' };
  }
}
