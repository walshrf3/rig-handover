import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board digest links', () => {
  it('links each night to its digest with ok / retry / fail counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    const item = (n: string) => html.split('<li>').find((s) => s.includes(`>${n}</a>`)) ?? '';
    expect(item('2026-10-28')).toMatch(/ok 10[\s\S]*retry 4[\s\S]*fail 1/);
    expect(item('2026-10-27')).toMatch(/ok 7[\s\S]*retry 0[\s\S]*fail 0/);
  });
});
