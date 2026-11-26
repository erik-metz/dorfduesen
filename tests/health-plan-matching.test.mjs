import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { buildHealthOnlyCanonicalActivities } = loadTs('lib/mobile/health-overview.ts');
const workout = (id, start, seconds, meters) => ({
  id, provider: 'APPLE_HEALTH', recordId: id, recordType: 'workout', startAt: new Date(start),
  endAt: new Date(new Date(start).getTime() + seconds * 1000), sourceName: 'Apple Watch', sourceId: 'watch',
  value: { activityType: 37, duration: { unit: 's', quantity: seconds }, totalDistance: { unit: 'meters', quantity: meters } },
});

test('Health-only runs become activities and Strava twins are mapped for plan matches', () => {
  const records = [workout('a', '2026-11-24T07:00:00Z', 2400, 5000), workout('b', '2026-11-26T07:00:00Z', 2700, 5400)];
  const strava = [{ id: 'act-1', stravaId: '123', name: 'Lauf', sportType: 'Run', startDate: new Date('2026-11-26T07:01:00Z'), elapsedTime: 2800, distance: 5390 }];
  const { activities, stravaByHealthActivity } = buildHealthOnlyCanonicalActivities('u', records, strava, new Date('2026-11-27T00:00:00Z'));
  assert.equal(activities.length, 1);
  assert.equal(activities[0].id, 'health:a');
  assert.equal(activities[0].sportType, 'Run');
  assert.equal(activities[0].distance, 5000);
  assert.equal(stravaByHealthActivity.get('health:b'), 'act-1');
});
