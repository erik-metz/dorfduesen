import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { teamContributions, buildTeamChallenge } = loadTs('lib/arena/team-challenge.ts');
const now = new Date('2026-10-29T12:00:00Z');
const activity = (userId, distance, extra = {}) => ({ userId, distance, movingTime: 1800,
  manualDistance: null, extractedDistance: null, startDate: new Date('2026-10-10T12:00:00Z'), ...extra });

test('team mission counts corrected positive kilometers from active contributors only', () => {
  const contributions = teamContributions([
    activity('a', 900000), activity('b', 0, { extractedDistance: 110000, manualDistance: 100000 }),
    activity('empty', 100000, { movingTime: 0 }), activity('zero', 0), activity('negative', -1000),
    activity('future', 100000, { startDate: new Date('2026-10-30') }),
    activity('previous', 100000, { startDate: new Date('2026-09-30T21:59:59Z') }),
    activity('next', 100000, { startDate: new Date('2026-10-31T23:00:00Z') }),
  ], now, now);
  assert.equal(contributions.size, 2);
  const challenge = buildTeamChallenge(contributions, now);
  assert.equal(challenge.currentKm, 1000);
  assert.equal(challenge.isCompleted, true);
  assert.equal(challenge.percentage, 100);
  assert.equal(challenge.monthLabel, 'Oktober 2026');
  assert.equal(challenge.daysRemaining, 2);
  assert.equal(buildTeamChallenge(new Map([['a', 999999]]), now).isCompleted, false);
});

test('Berlin month boundaries and year rollover assign each activity once', () => {
  const boundary = activity('a', 1000, { startDate: new Date('2026-12-31T23:00:00Z') });
  const january = new Date('2027-01-01T12:00:00Z');
  assert.equal(teamContributions([boundary], new Date('2026-12-31T12:00:00Z'), january).size, 0);
  assert.equal(teamContributions([boundary], january, january).get('a'), 1000);
  assert.equal(buildTeamChallenge(new Map(), january).monthLabel, 'Januar 2027');
});

function awardHarness(activities) {
  const badges = [], owned = [], notifications = [], tags = [];
  const tx = {
    $queryRaw: async () => [],
    activity: { findMany: async () => activities },
    badge: { upsert: async ({ create }) => {
      const existing = badges.find(badge => badge.code === create.code);
      if (existing) return existing;
      const badge = { ...create, id: create.code }; badges.push(badge); return badge;
    } },
    userBadge: {
      findMany: async ({ where }) => owned.filter(item => item.badgeId === where.badgeId),
      create: async ({ data }) => { owned.push(data); },
    },
    notification: { create: async ({ data }) => notifications.push(data) },
  };
  const awards = loadTs('lib/arena/team-awards.ts', {
    '@/lib/db': { db: { $transaction: async fn => fn(tx) } },
    '@/lib/cache-tags': { cacheTags: { trophies: 'trophies', notifications: 'notifications', arena: 'arena' },
      invalidateCacheTags: (...values) => tags.push(...values) },
  });
  return { ...awards, badges, owned, notifications, tags };
}

test('all contributors get one dated trophy and notification; retries and later contributors are safe', async () => {
  const activities = [activity('a', 900000), activity('b', 99999), activity('inactive', 0)];
  const harness = awardHarness(activities);
  await harness.awardMonthlyTeamChallenge(now, now);
  assert.equal(harness.owned.length, 0);
  activities.push(activity('b', 1));
  await harness.awardMonthlyTeamChallenge(now, now);
  await harness.awardMonthlyTeamChallenge(now, now);
  assert.equal(harness.owned.length, 2);
  assert.equal(harness.notifications.length, 2);
  assert.equal(harness.badges[0].name, 'Gemeinsam 1.000 km · Oktober 2026');
  assert.equal(harness.owned[1].metadata.contributionKm, 100);
  assert.equal(harness.owned[0].metadata.monthKey, '2026-10');
  assert.ok(harness.tags.includes('trophies'));
  assert.ok(harness.tags.includes('notifications'));
  activities.push(activity('late', 500));
  await harness.awardMonthlyTeamChallenge(now, now);
  assert.equal(harness.owned.length, 3);
  assert.equal(harness.notifications.length, 3);
  assert.equal(harness.owned[2].userId, 'late');
});

test('new months earn separate trophies and old awards persist', async () => {
  const activities = [activity('a', 1000000)];
  const harness = awardHarness(activities);
  await harness.awardMonthlyTeamChallenge(now, now);
  const november = new Date('2026-11-02T12:00:00Z');
  await harness.evaluateMonthlyTeamChallenges(november);
  assert.equal(harness.owned.length, 1);
  activities.push(activity('a', 1000000, { startDate: new Date('2026-11-01T12:00:00Z') }));
  await harness.evaluateMonthlyTeamChallenges(november);
  assert.equal(harness.owned.length, 2);
  assert.equal(harness.badges[1].name, 'Gemeinsam 1.000 km · November 2026');
  // Awarded trophies remain a permanent record even after subsequent activity corrections.
  activities.length = 0;
  await harness.evaluateMonthlyTeamChallenges(november);
  assert.equal(harness.owned.length, 2);
});

test('trophy collection returns a separate card for each earned month with accurate counts', async () => {
  const badge = month => ({ level: 1, unlockedAt: now, metadata: { monthKey: month }, badge: {
    code: `MONTHLY_TEAM_1000_${month}`, name: `Monat ${month}`, icon: '🏆', category: 'MONTHLY', rarity: 'EPIC',
  } });
  const { getUserTrophies } = loadTs('lib/data/trophies.ts', {
    '@/lib/db': { db: { userBadge: { findMany: async () => [badge('2026-09'), badge('2026-10')] },
      weeklyTitleHolder: { findMany: async () => [] }, monthlyTitleHolder: { findMany: async () => [] } } },
    '@/lib/arena/stats': { getWeeklyChampions: async () => [] },
    'next/cache': { cacheLife() {}, cacheTag() {} },
  });
  const result = await getUserTrophies('a');
  const earned = result.badges.filter(b => b.isUnlocked);
  assert.equal(earned.length, 2);
  assert.equal(earned[0].code, 'MONTHLY_TEAM_1000_2026-10');
  assert.equal(result.stats.monthlyAwardsCount, 2);
  assert.equal(result.stats.totalCount, result.badges.length);
  assert.ok(!result.badges.some(b => b.code === 'MONTHLY_TEAM_1000'));
});
