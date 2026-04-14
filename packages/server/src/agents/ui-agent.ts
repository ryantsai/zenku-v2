import { createOrUpdateView } from '../tools/view-tools';
import type { ViewDefinition, AgentResult } from '../types';

interface UiInput {
  action: 'create_view' | 'update_view';
  view: ViewDefinition;
}

export function runUiAgent(input: UiInput, userRequest: string): AgentResult {
  return createOrUpdateView(input.view, userRequest);
}
