import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { estimateVo2max } = loadTs('lib/training/vo2max.ts');
const { calculateFitnessHistory } = loadTs('lib/training/history.ts');
const now = new Date('2026-10-12T12:00:00Z');
const run = (days, extra = {}) => ({
  startDate: new Date(now.getTime() - days * 86400000), sportType: 'Run', distance: 5000,
  movingTime: 1800, elapsedTime: 1850, averageHeartrate: 145, maxHeartrate: 175,
  totalElevationGain: 15, ...extra,
});
const runs = [run(1), run(3), run(5)];

test('uses oxygen reserve correctly rather than equating HRR to percent VO2max', () => {
  const estimate = estimateVo2max(runs, now, 190, 'profile', 50);
  const expected = Math.round((3.5 + (0.2 * (5000 / 30)) / ((145 - 50) / (190 - 50))) * 10) / 10;
  assert.equal(estimate.value, expected);
  assert.equal(estimate.method, 'oxygen-reserve');
  assert.equal(estimate.sampleCount, 3);
  assert.equal(estimate.quality, 'limited');
});

test('without resting HR uses the HRmax relation and labels assumed parameters', () => {
  const estimate = estimateVo2max(runs, now, 185, 'default');
  const expected = Math.round((0.2 * (5000 / 30) + 3.5) / ((145 / 185 - 0.37) / 0.64) * 10) / 10;
  assert.equal(estimate.value, expected);
  assert.equal(estimate.method, 'hrmax');
  assert.equal(estimate.maxHrSource, 'default');
  assert.equal(estimate.quality, 'limited');
  assert.equal(estimateVo2max(runs, now, 185, 'default', NaN).value, estimate.value);
});

test('does not fabricate estimates from missing or unsuitable activity data', () => {
  const rejected = [
    { averageHeartrate: null }, { averageHeartrate: NaN }, { distance: Infinity },
    { elapsedTime: 2300 }, { elapsedTime: 0 }, { movingTime: 600 },
    { totalElevationGain: 100 }, { totalElevationGain: -1 }, { distance: 1000 },
    { averageHeartrate: 184 }, { averageHeartrate: 95 }, { sportType: 'TrailRun' },
    { sportType: 'VirtualRun' }, { sportType: 'Ride' },
  ];
  for (const extra of rejected) {
    const result = estimateVo2max([run(1, extra), run(2, extra), run(3, extra)], now, 190, 'profile', 50);
    assert.equal(result.value, null, JSON.stringify(extra));
    assert.equal(result.sampleCount, 0, JSON.stringify(extra));
  }
  for (const hr of [NaN, 0, 120, 231]) assert.equal(estimateVo2max(runs, now, hr, 'profile').value, null);
});

test('requires distinct days, excludes future and old data, and pauses stale estimates', () => {
  assert.equal(estimateVo2max([run(1), run(1), run(1)], now, 190, 'profile').value, null);
  assert.equal(estimateVo2max([run(-1), run(-2), run(-3)], now, 190, 'profile').sampleCount, 0);
  assert.equal(estimateVo2max([run(43), run(44), run(45)], now, 190, 'profile').sampleCount, 0);
  const stale = estimateVo2max([run(20), run(22), run(24)], now, 190, 'profile');
  assert.equal(stale.value, null);
  assert.match(stale.reason, /14 Tagen/);
});

test('rejects an isolated outlier and weights newer runs more strongly', () => {
  const stable = estimateVo2max(runs, now, 190, 'profile', 50);
  const filtered = estimateVo2max([...runs, run(2, { distance: 7000 })], now, 190, 'profile', 50);
  assert.equal(filtered.value, stable.value);
  assert.equal(filtered.sampleCount, 3);
  const recentFast = estimateVo2max([run(1, { distance: 5200 }), run(15), run(25)], now, 190, 'profile', 50);
  const oldFast = estimateVo2max([run(1), run(15), run(25, { distance: 5200 })], now, 190, 'profile', 50);
  assert.ok(recentFast.value > oldFast.value);
});

test('data quality improves only with multiple consistent days and supplied pulse parameters', () => {
  const six = Array.from({ length: 6 }, (_, i) => run(i + 1));
  assert.equal(estimateVo2max(six, now, 190, 'profile', 50).quality, 'moderate');
  assert.equal(estimateVo2max(six, now, 190, 'age', 50).quality, 'limited');
  assert.equal(estimateVo2max(six, now, 190, 'profile').quality, 'limited');
});

test('historical VO2max uses only the activities and health data available by that date', () => {
  const history = calculateFitnessHistory('u', runs, [{ date: run(-1).startDate, restingHeartrate: 40, weightKg: 60 }], now);
  assert.equal(history[0].vo2max.value, null);
  assert.equal(history.at(-2).vo2max.value, null);
  assert.equal(history.at(-1).vo2max.method, 'hrmax');
  assert.equal(history.at(-1).vo2max.maxHrSource, 'recorded');
  assert.equal(history.at(-1).vo2max.sampleCount, 3);
  assert.ok(history.at(-1).vo2max.value > 20);
});
