import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

test('generation quota survives deleting plans and blocks simultaneous requests', async () => {
  let attempts = 0;
  let pending = null;
  let locked = false;
  const tx = {
    $queryRaw: async () => { locked = true; },
    planGenerationAttempt: {
      count: async () => { assert.equal(locked, true); return attempts; },
      create: async () => { attempts++; },
    },
    trainingPlan: {
      findFirst: async () => pending,
      create: async ({ data }) => { pending = { ...data, id: 'new' }; return pending; },
    },
  };
  const { reservePlan } = loadTs('lib/training/plan-requests.ts', {
    '@/lib/db': { db: { $transaction: async fn => { locked = false; return fn(tx); } } },
  });
  const input = { title: 'Plan', goalType: '5K', startDate: new Date(), endDate: new Date(), totalWeeks: 8 };
  assert.equal((await reservePlan('user', input)).kind, 'created');
  assert.equal((await reservePlan('user', input)).kind, 'pending');
  for (let i = 1; i < 5; i++) {
    pending = null; // deletion removes plans, not the attempt ledger
    assert.equal((await reservePlan('user', input)).kind, 'created');
  }
  pending = null;
  assert.equal((await reservePlan('user', input)).kind, 'limit');
  assert.equal(attempts, 5);
});
