import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { historySeries, formatHistoryValue, continuousSegments } = loadTs('lib/training/history-series.ts');
const { calculateFitnessHistory } = loadTs('lib/training/history.ts');
const now = new Date('2026-10-12T12:00:00Z');
const runs = [1, 2, 3, 4].map(days => ({ startDate: new Date(now.getTime() - days * 86400000), sportType: 'Run', distance: 5000, movingTime: 1800, elapsedTime: 1800, averageHeartrate: 145, maxHeartrate: 175, totalElevationGain: 0 }));
const history = calculateFitnessHistory('u', runs, [], now);

test('pace bands preserve both boundaries as numeric seconds, with correct minute formatting', () => {
  const point = { ...history.at(-1), paces: { ...history.at(-1).paces, easyMin: '5:50', easyMax: '6:10' } };
  const series = historySeries([point], 'paces');
  assert.equal(series.length, 5);
  assert.equal(series[0].values[0].min, 350);
  assert.equal(series[0].values[0].max, 370);
  assert.equal(formatHistoryValue(359.8, 'paces'), '6:00');
  assert.equal(formatHistoryValue(350, 'paces'), '5:50');
  assert.equal(historySeries([history[0]], 'paces')[0].values[0], null);
});

test('zone bands use actual zone bounds rather than averages', () => {
  const point = history.at(-1);
  const series = historySeries([point], 'zones');
  assert.equal(series.length, 5);
  series.forEach((item, i) => {
    assert.equal(item.values[0].min, point.zones[i].minHr);
    assert.equal(item.values[0].max, point.zones[i].maxHr);
  });
});

test('missing weeks break chart lines and shaded bands instead of implying continuous data', () => {
  const point = { min: 40, max: 45 };
  const segments = continuousSegments([null, point, point, null, point, null, point, point]);
  assert.equal(JSON.stringify(segments), '[[1,2],[4],[6,7]]');
  assert.equal(continuousSegments([]).length, 0);
});

test('scalar series preserve unknown values and do not show training defaults as measurements', () => {
  assert.equal(historySeries([history[0]], 'vdot')[0].values[0], null);
  assert.equal(historySeries([history[0]], 'vo2max')[0].values[0], null);
  assert.equal(historySeries([history[0]], 'volume')[0].values[0], null);
  assert.equal(historySeries([history[0]], 'weight')[0].values[0], null);
  assert.equal(historySeries([history[0]], 'restingHr')[0].values[0], null);
  const point = { ...history.at(-1), weightKg: 70.4, restingHeartrate: 55 };
  assert.equal(historySeries([point], 'weight')[0].values[0].min, 70.4);
  assert.equal(historySeries([point], 'restingHr')[0].values[0].min, 55);
  assert.equal(formatHistoryValue(1.25, 'acwr'), '1,25');
});
