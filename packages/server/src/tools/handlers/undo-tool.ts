import { ZenkuTool } from '../types';
import { undoLast, undoById, undoSince } from '../journal-tools';

export const undoActionTool: ZenkuTool = {
  definition: {
    name: 'undo_action',
    description: `Undo previous operations. Call when user says "undo", "cancel last action", or "revert to previous version".
- target=last: Undo most recent reversible operation
- target=by_id: Undo operation by journal id
- target=by_time: Undo all operations after specified time (batch rollback)`,
    input_schema: {
      type: 'object' as const,
      properties: {
        target: {
          type: 'string',
          enum: ['last', 'by_id', 'by_time'],
        },
        journal_id: { type: 'number', description: 'Journal record ID when target=by_id' },
        since: { type: 'string', description: 'ISO timestamp when target=by_time (e.g., "2026-04-14 09:00:00")' },
      },
      required: ['target'],
    },
  },
  execute: async (input: any, userMessage?: string) => {
    const { target, journal_id, since } = input as { target: string; journal_id?: number; since?: string };
    if (target === 'last') return undoLast(userMessage!);
    if (target === 'by_id' && journal_id != null) return undoById(journal_id, userMessage!);
    if (target === 'by_time' && since) return undoSince(since, userMessage!);
    return { success: false, message: 'Invalid undo parameters' };
  },
};
