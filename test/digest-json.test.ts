import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

function appWithRuns(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(runsDir, name), body);
  return createApp({ ...base, runsDir });
}

describe('GET /api/digest/:night', () => {
  it('returns 200 with the 5 jobs of 2026-10-28 sorted by job', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows).toHaveLength(5);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
    expect(body.badLines).toBe(1); // the fixture ends in a truncated line
  });

  it('returns 404 JSON for a night with no file', async () => {
    const res = await appWithRuns({}).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns 404 JSON for a night that is not YYYY-MM-DD', async () => {
    const res = await appWithRuns({}).request('/api/digest/..%2Fx');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns an empty rows list for the empty night', async () => {
    const res = await appWithRuns({ '2026-02-02.jsonl': '' }).request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-02-02', rows: [], badLines: 0 });
  });

  it('returns 200 and counts a bad line', async () => {
    const good = '{"at":"2026-03-03T01:00:00+01:00","job":"a/b","status":"ok","owner":"rook"}';
    const res = await appWithRuns({ '2026-03-03.jsonl': `${good}\nnot json\n` }).request('/api/digest/2026-03-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[]; badLines: number };
    expect(body.rows).toHaveLength(1);
    expect(body.badLines).toBe(1);
  });
});
