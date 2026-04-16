import { ZenkuTool } from '../types';
import { runQueryAgent } from '../../agents/query-agent';

export const queryDataTool: ZenkuTool = {
  definition: {
    name: 'query_data',
    description: 'Query data and answer statistics questions. Can only execute SELECT queries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: { type: 'string', description: 'SELECT SQL statement' },
        explanation: { type: 'string', description: 'What this query does' },
      },
      required: ['sql', 'explanation'],
    },
  },
  execute: async (input: any) => {
    return runQueryAgent(input);
  },
};
