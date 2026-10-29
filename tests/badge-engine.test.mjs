import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

async function evaluate(activities, existing = []) {
  const created = [], removed = [];
  const db = {
    activity: { findMany: async () => activities },
    userBadge: { findMany: async () => existing, create: async ({ data }) => created.push(data),
      update: async () => {}, deleteMany: async ({ where }) => removed.push(where.id) },
    badge: { findUnique: async ({ where }) => ({ id: where.code }) },
    notification: { create: async () => {}, deleteMany: async () => {} },
  };
  const definitions = loadTs('lib/arena/badge-definitions.ts').BADGE_DEFINITIONS;
  const { evaluateUserBadges } = loadTs('lib/arena/badge-engine.ts', {
    'next/cache': { revalidateTag() {} },
    './team-awards': { evaluateMonthlyTeamChallenges: async () => [] },
    '@/lib/db': { db }, './badge-definitions': { BADGE_DEFINITIONS: definitions, ensureBadgesSeeded: async () => {} },
  });
  await evaluateUserBadges('athlete');
  return { codes: created.map(b => b.badgeId), removed };
}
const activity = (sportType, local = '2026-09-01T19:30:00Z', distance = 50000) => ({
  id: local, sportType, startDate: new Date(local), startDateLocal: new Date(local), distance,
  movingTime: 3600, totalElevationGain: 0,
});

test('running and electric rides cannot unlock the 50 km cycling badge', async () => {
  for (const sport of ['Run', 'EBikeRide', 'EMountainBikeRide', 'Workout']) {
    assert.ok(!(await evaluate([activity(sport)])).codes.includes('CHAIN_RIGHT'));
  }
  assert.ok((await evaluate([activity('Ride')])).codes.includes('CHAIN_RIGHT'));
});
test('Strava local wall-clock time is independent of server timezone', async () => {
  assert.ok(!(await evaluate([activity('Run')])).codes.includes('NIGHT_OWL'));
  assert.ok((await evaluate([activity('Run', '2026-09-01T21:30:00Z')])).codes.includes('NIGHT_OWL'));
  assert.ok((await evaluate([activity('Run', '2026-09-01T06:30:00Z')])).codes.includes('DAWN_PATROL'));
});
test('invalid stored awards are removed even when no activities remain', async () => {
  const existing = ['CHAIN_RIGHT', 'NIGHT_OWL'].map(code => ({ id: code, badge: { code }, level: 1 }));
  assert.equal((await evaluate([], existing)).removed.length, 2);
  assert.equal((await evaluate([activity('Run')], existing)).removed.length, 2);
});
test('empty recordings and future activities earn no badges', async () => {
  assert.equal((await evaluate([{ ...activity('Ride'), movingTime: 0 }])).codes.length, 0);
  assert.equal((await evaluate([activity('Ride', '2099-01-01T22:00:00Z')])).codes.length, 0);
});
test('four arbitrary weekly buckets do not satisfy every week of a calendar month', async () => {
  const dates = [1, 2, 8, 9, 15, 16, 22, 23];
  const activities = dates.map(d => activity('Run', `2026-09-${String(d).padStart(2, '0')}T12:00:00Z`, 1000));
  assert.ok(!(await evaluate(activities)).codes.includes('MONTH_STREAKER'));
  activities.push(activity('Run', '2026-09-28T12:00:00Z', 1000), activity('Run', '2026-09-29T12:00:00Z', 1000));
  assert.ok((await evaluate(activities)).codes.includes('MONTH_STREAKER'));
});
