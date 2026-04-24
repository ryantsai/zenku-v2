import { queryData } from '../tools/db-tools';
import type { AgentResult } from '../types';

interface QueryInput {
  sql: string;
  explanation: string;
}

export async function runQueryAgent(input: QueryInput): Promise<AgentResult> {
  return queryData(input.sql);
}
