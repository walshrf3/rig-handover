import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

function appWith(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(runsDir, name), body);
  return createApp({ ...base, runsDir });
}

const line = (o: Record<string, unknown>) => JSON.stringify(o);

describe('digest page', () => {
  it('renders the real night with 200', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('2026-10-28T23:00:06+01:00');
  });

  it('404s for a night with no file', async () => {
    const res = await appWith({}).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('404s for a malformed night', async () => {
    const app = appWith({});
    expect((await app.request('/digest/..%2Fsecret')).status).toBe(404);
    expect((await app.request('/digest/2026-1-1')).status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await appWith({ '2026-02-02.jsonl': '' }).request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line, sorted, with dashes and marks', async () => {
    const body = [
      line({ at: '2026-03-03T01:00:00+01:00', job: 'b/job', status: 'fail', owner: null, error: 'boom' }),
      'not json',
      line({ at: '2026-03-03T02:00:00+01:00', job: 'a/job', status: 'retry', owner: 'rook' }),
      line({ at: '2026-03-03T02:10:00+01:00', job: 'a/job', status: 'retry', owner: 'rook' }),
      line({ at: '2026-03-03T02:20:00+01:00', job: 'a/job', status: 'retry', owner: 'rook' }),
      line({ at: '2026-03-03T02:30:00+01:00', job: 'a/job', status: 'ok', owner: 'rook' }),
    ].join('\n');
    const res = await appWith({ '2026-03-03.jsonl': body }).request('/digest/2026-03-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('—');
    expect(html).toContain('boom');
    expect(html).toContain('2026-03-03T02:30:00+01:00');
    expect(html).toContain('many retries');
    expect(html).toContain('FAIL');
    expect(html).toContain('1 bad line');
  });
});
