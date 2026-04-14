import type { ViewDefinition, SSEChunk } from './types';

const BASE = '/api';

export async function getViews(): Promise<{ definition: ViewDefinition }[]> {
  const res = await fetch(`${BASE}/views`);
  return res.json();
}

export async function getTableData(table: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/data/${table}`);
  return res.json();
}

export async function createRow(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/data/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateRow(table: string, id: unknown, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/data/${table}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRow(table: string, id: unknown): Promise<void> {
  await fetch(`${BASE}/data/${table}/${id}`, { method: 'DELETE' });
}

export async function* sendChat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): AsyncGenerator<SSEChunk> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = line.slice(6).trim();
        if (json) {
          try {
            yield JSON.parse(json) as SSEChunk;
          } catch {
            // skip malformed
          }
        }
      }
    }
  }
}
