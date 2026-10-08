import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

test('one activity completes at most one workout and cannot match another owner', async () => {
  let matched = false;
  let updates = 0;
  const tx = {
    $queryRaw: async () => [],
    activity: { findFirst: async ({ where }) => where.userId === 'owner' ? { id: 'run' } : null },
    planWorkout: {
      findFirst: async () => matched ? { id: 'workout' } : null,
      updateMany: async ({ where }) => {
        assert.equal(where.status, 'PENDING');
        assert.equal(where.week.plan.status, 'ACTIVE');
        matched = true; updates++; return { count: 1 };
      },
    },
  };
  const { completeWorkoutOnce } = loadTs('lib/training/match.ts', {
    '@/lib/db': { db: { $transaction: async (fn) => fn(tx) } },
  });
  assert.equal(await completeWorkoutOnce('other', 'run', 'workout', 'Feedback'), false);
  assert.equal(await completeWorkoutOnce('owner', 'run', 'workout', 'Feedback'), true);
  assert.equal(await completeWorkoutOnce('owner', 'run', 'another-workout', 'Feedback'), false);
  assert.equal(updates, 1);
});
