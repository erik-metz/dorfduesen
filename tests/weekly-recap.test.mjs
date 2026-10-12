import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { buildWeeklyRecaps, snapshotWeeklyChampions } = loadTs('lib/arena/weekly-recap.ts');
const { computeHighlights } = loadTs('lib/arena/weekly-highlights.ts');
const week = '2026-10-12';
const user = id => ({ id, firstname: id, lastname: null, username: null, profile: null, createdAt: new Date('2026-01-01') });
const activity = (userId, date = week, distance = 5000, sportType = 'Run', movingTime = 1800) => ({
  userId, user: user(userId), startDate: new Date(`${date}T10:00:00Z`), startDateLocal: new Date(`${date}T12:00:00Z`), distance, sportType, movingTime,
});
function recaps(users, activities, goals = []) {
  const champions = computeHighlights(activities, week, goals, users);
  return buildWeeklyRecaps(week, users, activities, goals, champions);
}

test('shared winners each receive their own recap with every award', () => {
  const result = recaps([user('a'), user('b')], ['a', 'b'].flatMap(id => [activity(id), activity(id, '2026-10-13')]));
  for (const recap of result) {
    assert.equal(recap.metadata.outcome, 'celebration');
    assert.equal(recap.metadata.awards.length, 3); // Shared distance, stayed active, personal progress.
  }
});
test('one active day gives a concrete one-day gap without suggesting a different sport', () => {
  const users = [{ ...user('a'), createdAt: new Date('2026-10-10') }, user('winner')];
  const result = recaps(users, [activity('a', week, 1000), activity('winner', week, 10000)]).find(r => r.userId === 'a');
  assert.equal(result.metadata.outcome, 'motivation');
  assert.equal(result.metadata.missing, 1);
  assert.equal(result.metadata.unit, 'Tage');
  assert.match(result.message, /hätte 1 weiterer aktiver Tag gereicht/);
  assert.doesNotMatch(result.message, /Kette/);
});
test('close distance results round the gap up and explain the shared victory threshold', () => {
  const users = [{ ...user('a'), createdAt: new Date('2026-10-10') }, user('winner')];
  const result = recaps(users, [activity('a', week, 9901), activity('winner', week, 10002)]).find(r => r.userId === 'a');
  assert.equal(result.metadata.missing, 0.2);
  assert.equal(result.metadata.unit, 'km');
  assert.match(result.message, /geteilten Wochensieg/);
});
test('inactive members get a restart without a fabricated near miss; empty and next-week activities excluded', () => {
  const result = recaps([user('a')], [activity('a', week, 10000, 'Run', 0), activity('a', '2026-10-19')])[0];
  assert.equal(result.metadata.activeDays, 0);
  assert.equal(result.metadata.missing, 2);
  assert.doesNotMatch(result.message, /beinahe|knapp|hätte/);
  assert.match(result.message, /keine Aktivität gespeichert/);
});
test('late goals and insufficient history never create a misleading target', () => {
  const users = [{ ...user('a'), createdAt: new Date('2026-10-10') }, user('winner')];
  const goal = { userId: 'a', activeDays: 1, createdAt: new Date('2026-10-12T08:00:00Z'), updatedAt: new Date('2026-10-12T08:00:00Z') };
  const result = recaps(users, [activity('a', week, 1000), activity('winner', week, 10000)], [goal]).find(r => r.userId === 'a');
  assert.equal(result.metadata.targetTitle, 'Sofa hat verloren.');
});
test('members joining after the week ended receive no recap', () => {
  assert.equal(recaps([{ ...user('future'), createdAt: new Date('2026-10-19T10:00:00Z') }], []).length, 0);
});

test('equally close personal goals take precedence over a generic participation target', () => {
  const users = [{ ...user('a'), createdAt: new Date('2026-10-10') }, user('winner')];
  const goal = { userId: 'a', activeDays: 2, createdAt: new Date('2026-10-10T08:00:00Z'), updatedAt: new Date('2026-10-10T08:00:00Z') };
  const result = recaps(users, [activity('a', week, 1000), activity('winner', week, 10000)], [goal]).find(r => r.userId === 'a');
  assert.equal(result.metadata.targetTitle, 'Vorgenommen. Durchgezogen.');
  assert.equal(result.metadata.missing, 1);
});
test('legacy titles with no eligible next target fall back to honest encouragement', () => {
  const activities = Array.from({ length: 7 }, (_, i) => activity('a', `2026-10-${12 + i}`));
  const result = buildWeeklyRecaps(week, [user('a')], activities, [], []);
  assert.equal(result[0].metadata.outcome, 'motivation');
  assert.doesNotMatch(result[0].message, /hätte|beinahe|knapp/);
});


test('recaps celebrate persisted winners rather than a recalculated leader after late edits', () => {
  const activities = [activity('new-leader', week, 50000)];
  const users = [user('original-winner'), user('new-leader')];
  const champions = computeHighlights(activities, week, [], users);
  const snapshot = snapshotWeeklyChampions(champions, [{ titleId: 'run_distance:original-winner', userId: 'original-winner', value: 10 }]);
  const result = buildWeeklyRecaps(week, users, activities, [], snapshot);
  assert.equal(result.find(r => r.userId === 'original-winner').metadata.outcome, 'celebration');
  assert.equal(result.find(r => r.userId === 'original-winner').metadata.awards[0].formattedValue, '10.0 km');
  assert.equal(result.find(r => r.userId === 'new-leader').metadata.outcome, 'motivation');
});
