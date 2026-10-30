import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countStatuses } from '../src/digest/counts.js';

describe('countStatuses', () => {
  it('counts log lines per status, ignoring bad lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'counts-'));
    const l = (status: string) => JSON.stringify({ at: 'x', job: 'j', status, owner: null });
    writeFileSync(
      join(dir, '2026-01-01.jsonl'),
      [l('ok'), l('ok'), l('retry'), 'garbage', '', l('fail'), l('weird'), '{"at":"x","job":"j","sta'].join('\n'),
    );
    expect(countStatuses(dir, '2026-01-01')).toEqual({ ok: 2, retry: 1, fail: 1 });
  });

  it('reads the real nights', () => {
    expect(countStatuses('runs', '2026-10-28')).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(countStatuses('runs', '2026-10-27')).toEqual({ ok: 7, retry: 0, fail: 0 });
  });

  it('returns null when the night has no file', () => {
    expect(countStatuses('runs', '1999-01-01')).toBeNull();
  });
});
