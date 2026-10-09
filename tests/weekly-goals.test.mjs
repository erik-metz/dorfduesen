import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

function route(authenticated = true) {
  const writes = [];
  const tx = {
    $queryRaw: async () => [],
    weeklyGoal: { upsert: async args => { writes.push(args); return args.create; } },
  };
  const { POST } = loadTs('app/api/arena/goals/route.ts', {
    'next/server': { connection: async () => {}, NextResponse: Response },
    '@/lib/auth/session': { getCurrentUser: async () => authenticated ? { id: 'self' } : null },
    '@/lib/db': { db: { $transaction: async callback => callback(tx) } },
  });
  return { POST, writes };
}
const request = (body, origin = 'https://dorf.test') => new Request('https://dorf.test/api/arena/goals', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('weekly goals require same-origin authenticated requests and bounded integer targets', async () => {
  const { POST, writes } = route();
  assert.equal((await POST(request({ activeDays: 2 }, 'https://other.test'))).status, 403);
  for (const activeDays of [null, '2', 0, 8, 1.5]) assert.equal((await POST(request({ activeDays }))).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await route(false).POST(request({ activeDays: 2 }))).status, 401);
});

test('weekly goals always belong to the authenticated user and the next week', async () => {
  const { POST, writes } = route();
  const response = await POST(request({ activeDays: 2, userId: 'someone-else', weekKey: '2026-01-01' }));
  assert.equal(response.status, 200);
  const { goal } = await response.json();
  assert.equal(goal.userId, 'self');
  assert.equal(goal.activeDays, 2);
  assert.ok(goal.weekKey > '2026-01-01');
  assert.equal(writes[0].where.userId_weekKey.userId, 'self');
});
