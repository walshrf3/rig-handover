import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Counts log LINES per status for runs/<night>.jsonl (not per-job last status).
// Lenient: blank lines and lines that aren't a JSON object with a known status are ignored.
// Returns null when the night has no readable file.
export function countStatuses(runsDir: string, night: string): StatusCounts | null {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof value !== 'object' || value === null) continue;
    const status = (value as Record<string, unknown>).status;
    if (status === 'ok' || status === 'retry' || status === 'fail') counts[status]++;
  }
  return counts;
}
