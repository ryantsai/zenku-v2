import { ZenkuTool } from '../types';
import { writeData } from '../db-tools';

export const writeDataTool: ZenkuTool = {
  definition: {
    name: 'write_data',
    description: `Perform insert, update, or delete operations on user data tables. Cannot operate on system tables (_zenku_ prefix).

Operation guide:
- insert: Add a new record, populate data with field values
- update: Update records matching where condition, populate data with update values, where is required filter (mandatory to prevent full table updates)
- delete: Delete records matching where condition, where is required condition (mandatory to prevent full table deletion)

Note: where is a required safety guard for update/delete, cannot be omitted.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        operation: {
          type: 'string',
          enum: ['insert', 'update', 'delete'],
          description: 'Operation type',
        },
        table: {
          type: 'string',
          description: 'Target table name (lowercase English with underscores, cannot be system table)',
        },
        data: {
          type: 'object',
          description: 'Field values for insert/update (key is field name, value is value to write)',
        },
        where: {
          type: 'object',
          description: 'Filter conditions for update/delete (key is field name, value is match value). Required for update/delete',
        },
      },
      required: ['operation', 'table'],
    },
  },
  execute: async (input: any, userMessage?: string) => {
    return writeData(input, userMessage!);
  },
};
