import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (!night) return;
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    const refresh = night.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });

    const sync = night.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' });

    const backup = night.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps a row whose owner is null', () => {
    const night = readNight('runs', '2026-10-28');
    const render = night?.rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', firstAt: '2026-10-29T05:41:09+01:00' });
  });

  it('returns null when the night has no file', () => {
    expect(readNight(tempRuns({}), '2026-01-01')).toBeNull();
  });

  it('gives no rows and no bad lines for an empty file', () => {
    const dir = tempRuns({ '2026-01-01.jsonl': '' });
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts unparseable and invalid lines without throwing, and skips blank lines', () => {
    const lines = [
      '{"at":"2026-01-01T22:00:00-05:00","job":"b","status":"retry","owner":"x","error":"boom"}',
      'not json',
      '{"at":"2026-01-01T22:01:00-05:00","job":"b","status":"maybe","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}',
      '[1,2]',
      '',
      '{"at":"2026-01-01T22:02:00-05:00","job":"a","status":"ok","owner":null}',
      '{"at":"2026-01-01T22:03:00-05:00","job":"b","status":"fail","owner":"x","error":"still boom"}',
    ];
    const dir = tempRuns({ '2026-01-01.jsonl': lines.join('\n') + '\n' });
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toEqual([
      { job: 'a', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-01-01T22:02:00-05:00', lastAt: '2026-01-01T22:02:00-05:00' },
      { job: 'b', owner: 'x', runs: 2, retries: 1, lastStatus: 'fail', lastError: 'still boom', firstAt: '2026-01-01T22:00:00-05:00', lastAt: '2026-01-01T22:03:00-05:00' },
    ]);
  });
});
