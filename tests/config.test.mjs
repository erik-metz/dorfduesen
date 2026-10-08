import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

test('secrets reject missing, short and example values', () => {
  const previous = process.env.SESSION_SECRET;
  const { requireSecret } = loadTs('lib/config.ts');
  try {
    for (const value of ['', 'short', 'change-this-to-a-very-secure-random-32-char-secret-string']) {
      process.env.SESSION_SECRET = value;
      assert.throws(() => requireSecret('SESSION_SECRET'), /SESSION_SECRET/);
    }
    process.env.SESSION_SECRET = 'a'.repeat(48);
    assert.equal(requireSecret('SESSION_SECRET'), 'a'.repeat(48));
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test('cron denies unconfigured, query-only and incorrect credentials before accessing DB', async () => {
  const previous = process.env.CRON_SECRET;
  let jobs = 0;
  const { GET } = loadTs('app/api/strava/cron/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/inngest/client': { inngest: { send: async () => { jobs++; } } },
  });
  try {
    process.env.CRON_SECRET = '';
    assert.equal((await GET(new Request('https://example.com/api/strava/cron'))).status, 503);
    process.env.CRON_SECRET = 'b'.repeat(48);
    assert.equal((await GET(new Request(`https://example.com/api/strava/cron?secret=${process.env.CRON_SECRET}`))).status, 401);
    assert.equal((await GET(new Request('https://example.com/api/strava/cron', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
    assert.equal(jobs, 0);
    assert.equal((await GET(new Request('https://example.com/api/strava/cron', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))).status, 202);
    assert.equal(jobs, 1);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
