import { queryData } from '../tools/db-tools';
import type { AgentResult } from '../types';

interface QueryInput {
  sql: string;
  explanation: string;
}

export function runQueryAgent(input: QueryInput): AgentResult {
  return queryData(input.sql);
}
