import { ZenkuTool } from '../types';
import { runTestAgent } from '../../agents/test-agent';

export const assessImpactTool: ZenkuTool = {
  definition: {
    name: 'assess_impact',
    description: `Assess impact of destructive schema changes. Must call this tool before executing drop_column, rename_column, change_type, or drop_table.
Reports affected interfaces, rules, record count, and foreign key dependencies.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        table_name: { type: 'string', description: 'Table name to modify' },
        change_type: {
          type: 'string',
          enum: ['drop_column', 'rename_column', 'change_type', 'drop_table'],
        },
        details: {
          type: 'object',
          properties: {
            column_name: { type: 'string' },
            new_name: { type: 'string' },
            new_type: { type: 'string' },
          },
        },
      },
      required: ['table_name', 'change_type'],
    },
  },
  execute: async (input: any) => {
    return runTestAgent(input);
  },
};
