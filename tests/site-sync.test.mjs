import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

test('simultaneous visitors enqueue only one shared sync', async () => {
  let claimed = false;
  const events = [];
  const { queueSiteSync } = loadTs('lib/strava/queue.ts', {
    '@/lib/db': { db: { $executeRaw: async () => {
      if (claimed) return 0;
      claimed = true;
      return 1;
    } } },
    '@/lib/inngest/client': { inngest: { send: async event => events.push(event) } },
  });
  const results = await Promise.all(Array.from({ length: 20 }, () => queueSiteSync()));
  assert.equal(results.filter(result => result.queued).length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'strava/sync.all');
});

test('failed enqueue releases only its own claim and permits retry', async () => {
  const queries = [];
  let fail = true;
  const { queueSiteSync } = loadTs('lib/strava/queue.ts', {
    '@/lib/db': { db: { $executeRaw: async (sql, ...values) => {
      queries.push({ sql: sql.join('?'), values });
      return 1;
    } } },
    '@/lib/inngest/client': { inngest: { send: async () => {
      if (fail) throw new Error('unavailable');
    } } },
  });
  await assert.rejects(queueSiteSync(), /unavailable/);
  assert.match(queries[1].sql, /DELETE.*"owner" =/);
  assert.equal(queries[1].values[0], queries[0].values[0]);
  fail = false;
  assert.equal((await queueSiteSync()).queued, true);
});
