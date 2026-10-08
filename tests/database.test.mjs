import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { loadTs } from './load-ts.mjs';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) {
    throw new Error('Integration tests require a local database ending in _test');
  }
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const users = [];
after(async () => {
  if (db) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
async function user() {
  const result = await db.user.create({ data: { stravaAthleteId: `test-${crypto.randomUUID()}` } });
  users.push(result.id); return result;
}
const planData = userId => ({ userId, title: 'Test', goalType: '5K', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-01'), totalWeeks: 8 });
const activityData = (userId, date, distance = 5000) => ({ userId, stravaId: `test-${crypto.randomUUID()}`, name: 'Testlauf', distance, movingTime: 1800, elapsedTime: 1800, totalElevationGain: 10, sportType: 'Run', startDate: new Date(date), startDateLocal: new Date(date) });

test('database: concurrent requests reserve one plan; deleting plans retains quota', { skip: !url }, async () => {
  const u = await user();
  const { reservePlan } = loadTs('lib/training/plan-requests.ts', { '@/lib/db': { db } });
  const reservations = await Promise.all([reservePlan(u.id, planData(u.id)), reservePlan(u.id, planData(u.id))]);
  assert.equal(reservations.filter(r => r.kind === 'created').length, 1);
  assert.equal(reservations.filter(r => r.kind === 'pending').length, 1);
  for (let i = 1; i < 5; i++) {
    await db.trainingPlan.deleteMany({ where: { userId: u.id } });
    assert.equal((await reservePlan(u.id, planData(u.id))).kind, 'created');
  }
  await db.trainingPlan.deleteMany({ where: { userId: u.id } });
  assert.equal((await reservePlan(u.id, planData(u.id))).kind, 'limit');
});

test('database: concurrent matches complete only one workout', { skip: !url }, async () => {
  const u = await user();
  const plan = await db.trainingPlan.create({ data: { ...planData(u.id), status: 'ACTIVE' } });
  const week = await db.planWeek.create({ data: { planId: plan.id, weekNumber: 1, phase: 'BASE', targetDistance: 10 } });
  const workouts = await Promise.all([1, 2].map(() => db.planWorkout.create({ data: { weekId: week.id, scheduledDate: new Date('2026-01-02'), workoutType: 'EASY', title: 'Lauf', description: 'Locker' } })));
  const activity = await db.activity.create({ data: activityData(u.id, '2026-01-02') });
  const { completeWorkoutOnce } = loadTs('lib/training/match.ts', { '@/lib/db': { db } });
  const results = await Promise.all(workouts.map(w => completeWorkoutOnce(u.id, activity.id, w.id, 'Gut')));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await db.planWorkout.count({ where: { matchedActivityId: activity.id } }), 1);
});

test('database: failed replacement rolls back partial weeks and keeps the active plan', { skip: !url }, async () => {
  const u = await user();
  const active = await db.trainingPlan.create({ data: { ...planData(u.id), status: 'ACTIVE' } });
  const replacement = await db.trainingPlan.create({ data: { ...planData(u.id), status: 'QUEUED' } });
  const baseline = { estimatedVdot: 35, averageWeeklyKm: 20, measuredMaxHr: 185 };
  const skeleton = { totalWeeks: 1, startDate: new Date('2026-01-01'), targetDate: new Date('2026-02-01'), weeks: [] };
  const generated = [{ weekNumber: 1, phase: 'BASE', targetDistance: 5, isDeloadWeek: false, workouts: [{ date: 'invalid', workoutType: 'EASY', title: 'Lauf', description: 'Locker' }] }];
  const { generatePlanFunction } = loadTs('lib/inngest/functions/generatePlan.ts', {
    '../client': { inngest: { createFunction: (options, handler) => ({ options, handler }) } },
    '@/lib/db': { db },
    '../../training/baseline': { calculateAthleteBaseline: async () => baseline },
    '../../training/periodization': { buildPeriodizationSkeleton: () => skeleton },
    '../../ai/generator': { generatePlanWithGrok: async () => generated },
  });
  const event = { data: { userId: u.id, planId: replacement.id, goalType: '5K' } };
  await assert.rejects(generatePlanFunction.handler({ event, step: { run: async (_id, fn) => fn() } }));
  assert.equal((await db.trainingPlan.findUnique({ where: { id: active.id } })).status, 'ACTIVE');
  assert.equal(await db.planWeek.count({ where: { planId: replacement.id } }), 0);
  await generatePlanFunction.options.onFailure({ event: { data: { event } } });
  assert.equal((await db.trainingPlan.findUnique({ where: { id: replacement.id } })).status, 'FAILED');
  generated[0].workouts[0].date = '2026-01-02';
  await db.trainingPlan.update({ where: { id: replacement.id }, data: { status: 'QUEUED' } });
  await generatePlanFunction.handler({ event, step: { run: async (_id, fn) => fn() } });
  assert.equal((await db.trainingPlan.findUnique({ where: { id: replacement.id } })).status, 'ACTIVE');
  assert.equal((await db.trainingPlan.findUnique({ where: { id: active.id } })).status, 'PAUSED');
});

test('database: previous-week awards exclude the current week and are idempotent', { skip: !url }, async () => {
  const previousWinner = await user();
  const currentWinner = await user();
  await db.activity.create({ data: activityData(previousWinner.id, '2026-10-01T10:00:00Z', 10000) });
  await db.activity.create({ data: activityData(currentWinner.id, '2026-10-04T22:01:00Z', 30000) });
  const { finalizeWeeklyAwards } = loadTs('lib/arena/awards-finalizer.ts', {
    '@/lib/db': { db }, 'next/cache': { cacheLife() {}, cacheTag() {} },
  });
  const reference = new Date('2026-10-04T22:05:00Z');
  await Promise.all([finalizeWeeklyAwards(reference), finalizeWeeklyAwards(reference)]);
  const holder = await db.weeklyTitleHolder.findUnique({ where: { weekKey_titleId: { weekKey: '2026-09-28', titleId: 'distance' } } });
  assert.equal(holder.userId, previousWinner.id);
  const badge = await db.userBadge.findFirst({ where: { userId: previousWinner.id, badge: { code: 'WEEKLY_DISTANCE' } } });
  assert.equal(badge.level, 1);
  assert.equal(badge.metadata.history.length, 1);
  assert.equal(await db.notification.count({ where: { userId: previousWinner.id, metadata: { path: ['titleId'], equals: 'distance' }, type: 'WEEKLY_CHAMPION' } }), 1);
});

test('database: sync leases prevent overlap and page progress survives rate limits', { skip: !url }, async () => {
  const u = await user();
  const id = Date.now();
  const raw = n => ({ id: id + n, name: 'Test', distance: 5000, moving_time: 1800, elapsed_time: 1800,
    total_elevation_gain: 10, sport_type: 'Run', start_date: '2026-01-02T10:00:00Z', start_date_local: '2026-01-02T11:00:00Z' });
  let release;
  let started;
  const fetched = new Promise(resolve => { started = resolve; });
  let nextResponse = null;
  const { syncUserActivities } = loadTs('lib/strava/sync.ts', {
    '@/lib/db': { db }, './tokens': { getValidStravaToken: async () => 'test' },
    '@/lib/inngest/client': { inngest: { send: async () => { throw new Error('Unexpected event without active plan'); } } },
    fetch: async () => {
      if (nextResponse) return nextResponse;
      started(); return new Promise(resolve => { release = resolve; });
    },
  });
  const first = syncUserActivities(u.id, 2, { page: 1, historical: true });
  await fetched;
  const overlap = await syncUserActivities(u.id, 2, { page: 1, historical: true });
  assert.equal(overlap.success, false);
  assert.ok(overlap.retryAt);
  release(Response.json([raw(1), raw(2)]));
  assert.equal((await first).hasMore, true);
  assert.equal((await db.syncState.findUnique({ where: { userId: u.id } })).historicalPage, 2);
  nextResponse = new Response('', { status: 429, headers: { 'retry-after': '60' } });
  const rateLimit = await syncUserActivities(u.id, 2, { page: 2, historical: true });
  assert.equal(rateLimit.success, false);
  assert.ok(rateLimit.retryAt);
  assert.equal((await db.syncState.findUnique({ where: { userId: u.id } })).historicalPage, 2);
  nextResponse = Response.json([raw(3)]);
  assert.equal((await syncUserActivities(u.id, 2, { page: 2, historical: true })).hasMore, false);
  const state = await db.syncState.findUnique({ where: { userId: u.id } });
  assert.ok(state.historyCompletedAt);
  assert.equal(state.lockOwner, null);
  assert.equal(await db.activity.count({ where: { userId: u.id } }), 3);
});

test('database: parallel token refreshes use the single rotated token', { skip: !url }, async () => {
  const u = await user();
  await db.account.create({ data: { userId: u.id, accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 } });
  const previousId = process.env.STRAVA_CLIENT_ID;
  const previousSecret = process.env.STRAVA_CLIENT_SECRET;
  process.env.STRAVA_CLIENT_ID = 'test'; process.env.STRAVA_CLIENT_SECRET = 'test';
  let refreshes = 0;
  const { getValidStravaToken } = loadTs('lib/strava/tokens.ts', {
    '@/lib/db': { db }, fetch: async () => {
      refreshes++;
      return Response.json({ access_token: 'new', refresh_token: 'rotated', expires_at: Math.floor(Date.now() / 1000) + 3600 });
    },
  });
  try {
    assert.deepEqual(await Promise.all([getValidStravaToken(u.id), getValidStravaToken(u.id)]), ['new', 'new']);
    assert.equal(refreshes, 1);
  } finally {
    if (previousId === undefined) delete process.env.STRAVA_CLIENT_ID; else process.env.STRAVA_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.STRAVA_CLIENT_SECRET; else process.env.STRAVA_CLIENT_SECRET = previousSecret;
  }
});
