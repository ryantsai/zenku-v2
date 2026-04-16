import { ToolDefinition } from '../ai';
import { AgentResult } from '../types';

export interface ZenkuTool {
  definition: ToolDefinition;
  execute: (input: any, context?: any) => Promise<AgentResult> | AgentResult;
}
