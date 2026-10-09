import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { computeHighlights } = loadTs('lib/arena/weekly-highlights.ts');
const week = '2026-10-12';
const user = id => ({ id, firstname: id, lastname: null, username: null, profile: null });
const activity = (id, date, sportType = 'Run', distance = 5000, movingTime = 1800) => ({ user: user(id), startDate: new Date(`${date}T10:00:00Z`), startDateLocal: new Date(`${date}T12:00:00Z`), sportType, distance, movingTime });
const joined = ids => ids.map(id => ({ id, createdAt: new Date('2026-01-01') }));
const recipients = (titles, id) => titles.find(t => t.id === id).recipients.map(r => r.userId);

test('running and cycling are separate, ties share wins, e-bikes excluded', () => {
  const result = computeHighlights([
    activity('runner', week), activity('runner', '2026-10-13'),
    activity('rider', week, 'Ride', 50000), activity('ebike', week, 'EBikeRide', 100000),
    activity('tie', week, 'TrailRun', 10000),
  ], week, [], joined(['runner', 'rider', 'ebike', 'tie']));
  assert.deepEqual([...recipients(result, 'run_distance')], ['runner', 'tie']);
  assert.deepEqual([...recipients(result, 'ride_distance')], ['rider']);
  assert.deepEqual([...recipients(result, 'stayed_active')], ['runner']);
  assert.equal(result.some(t => t.id === 'heartrate'), false);
});

test('everyone with two different days qualifies; empty recordings and split sessions do not add days', () => {
  const result = computeHighlights([
    activity('a', week), activity('a', week), activity('a', '2026-10-13', 'Yoga', 0),
    activity('b', week, 'Walk'), activity('b', '2026-10-14', 'WeightTraining', 0),
    activity('c', week), activity('c', '2026-10-13', 'Run', 1000, 0),
  ], week, [], joined(['a', 'b', 'c']), { a: 10, b: 0 });
  assert.deepEqual([...recipients(result, 'stayed_active')], ['b', 'a']);
});

test('routine spans three weeks, progress uses four full weeks including zero weeks, new members excluded', () => {
  const activities = ['old', 'new'].flatMap(id => [
    activity(id, '2026-09-28'), activity(id, '2026-09-29'),
    activity(id, '2026-10-05'), activity(id, '2026-10-06'),
    activity(id, week), activity(id, '2026-10-13'),
  ]);
  const result = computeHighlights(activities, week, [], [
    { id: 'old', createdAt: new Date('2026-01-01') }, { id: 'new', createdAt: new Date('2026-10-01') },
  ]);
  assert.deepEqual([...recipients(result, 'routine')], ['new', 'old']);
  assert.deepEqual([...recipients(result, 'progress')], ['old']);
  assert.match(result.find(t => t.id === 'progress').recipients[0].formattedValue, /zuvor Ø 1/);
});

test('goals must be chosen and last edited before Berlin week start; future activities excluded', () => {
  const goal = (userId, timestamp) => ({ userId, activeDays: 2, createdAt: new Date(timestamp), updatedAt: new Date(timestamp) });
  const activities = ['valid', 'late', 'edited'].flatMap(id => [activity(id, week), activity(id, '2026-10-13')]);
  activities.push(activity('future', '2026-10-19'));
  const edited = { ...goal('edited', '2026-10-10T12:00:00Z'), updatedAt: new Date('2026-10-12T08:00:00Z') };
  const result = computeHighlights(activities, week, [goal('valid', '2026-10-11T21:59:59Z'), goal('late', '2026-10-11T22:00:00Z'), edited], joined(['valid', 'late', 'edited', 'future']));
  assert.deepEqual([...recipients(result, 'goal')], ['valid']);
  assert.equal(recipients(result, 'run_distance').includes('future'), false);
});

test('weekly finalization awards every shared recipient exactly once, including after a retry', async () => {
  const holders = new Map();
  const awards = new Map();
  const notifications = [];
  const tx = {
    $queryRaw: async () => [],
    weeklyTitleHolder: {
      findUnique: async ({ where }) => holders.get(JSON.stringify(where.weekKey_titleId)) ?? null,
      upsert: async ({ where, create }) => { holders.set(JSON.stringify(where.weekKey_titleId), create); return create; },
    },
    badge: { findUnique: async ({ where }) => ({ id: where.code }) },
    userBadge: {
      findUnique: async ({ where }) => awards.get(JSON.stringify(where.userId_badgeId)) ?? null,
      create: async ({ data }) => { awards.set(JSON.stringify({ userId: data.userId, badgeId: data.badgeId }), data); return data; },
      update: async () => { throw new Error('Unexpected duplicate award'); },
    },
    notification: { create: async ({ data }) => { notifications.push(data); } },
  };
  const champions = computeHighlights([
    activity('a', week), activity('a', '2026-10-13'),
    activity('b', week), activity('b', '2026-10-13'),
  ], week, [], []);
  const { finalizeWeeklyAwards } = loadTs('lib/arena/awards-finalizer.ts', {
    '@/lib/db': { db: { $transaction: async callback => callback(tx) } },
    './stats': { getWeeklyChampions: async () => champions },
    './badge-definitions': { ensureBadgesSeeded: async () => {} },
  });
  await finalizeWeeklyAwards(new Date('2026-10-19T10:00:00Z'));
  await finalizeWeeklyAwards(new Date('2026-10-19T10:00:00Z'));
  assert.equal(awards.size, 4); // Two tied running winners and two personal recognitions.
  assert.equal(notifications.length, 4);
  assert.ok(awards.has(JSON.stringify({ userId: 'a', badgeId: 'WEEKLY_STAYED_ACTIVE' })));
  assert.ok(awards.has(JSON.stringify({ userId: 'b', badgeId: 'WEEKLY_STAYED_ACTIVE' })));
  assert.equal([...holders.values()].every(h => h.isFinalized), true);
});
