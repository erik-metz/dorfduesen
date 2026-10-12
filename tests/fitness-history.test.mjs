import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { calculateFitnessHistory } = loadTs('lib/training/history.ts');
const { baselineFromActivities } = loadTs('lib/training/baseline-calculation.ts');
const now = new Date('2026-10-12T12:00:00Z');
const run = (days, extra = {}) => ({ startDate: new Date(now.getTime() - days * 86400000), sportType: 'Run', distance: 5000, movingTime: 1800, averageHeartrate: 145, maxHeartrate: 175, totalElevationGain: 0, ...extra });

test('history excludes future activity and does not fabricate fitness with insufficient data', () => {
  const history = calculateFitnessHistory('u', [run(1), run(-1)], [], now);
  assert.equal(history.length, 26);
  assert.equal(history.at(-1).baseline.runCount, 1);
  assert.equal(history.at(-1).vdot, null);
  assert.equal(history.at(-1).paces, null);
  assert.equal(history[0].baseline.runCount, 0);
});

test('historical health values carry forward independently without leaking future entries', () => {
  const metric = (days, weightKg, restingHeartrate) => ({ date: run(days).startDate, weightKg, restingHeartrate });
  const history = calculateFitnessHistory('u', [run(1), run(2), run(3), run(4)], [metric(10, 70, 55), metric(2, 69, null), metric(-1, 68, 50)], now);
  assert.equal(history.at(-1).restingHeartrate, 55);
  assert.equal(history.at(-1).weightKg, 69);
  assert.equal(history.at(-2).weightKg, 70);
  assert.equal(history[0].weightKg, null);
  assert.ok(history.at(-1).paces);
});

test('a training pause reduces workload to zero and old performances leave the fitness window', () => {
  const runs = [run(40), run(41), run(42), run(43)];
  const baseline = baselineFromActivities('u', runs, null, now);
  assert.equal(baseline.acwr, 0);
  const later = baselineFromActivities('u', runs, null, new Date(now.getTime() + 90 * 86400000));
  assert.equal(later.hasSufficientData, false);
  assert.equal(later.runCount, 0);
});

test('corrupt and short runs do not establish a reliable fitness estimate', () => {
  const runs = [run(1, { movingTime: 100 }), run(2, { distance: 500 }), run(3), run(4)];
  const latest = calculateFitnessHistory('u', runs, [], now).at(-1);
  assert.equal(latest.baseline.fitnessSampleCount, 2);
  assert.equal(latest.vdot, null);
});
