import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { championProgress } = loadTs('lib/arena/champion-progress.ts');
const champion = (id, value, userId = 'leader') => ({ id, winner: { value, userId } });

test('targets beat the unrounded leader, including ties and empty categories', () => {
  assert.match(championProgress(champion('distance', 10.04), 8, 'me'), /2,1 km/);
  assert.match(championProgress(champion('distance', 10), 10, 'me'), /0,1 km/);
  assert.match(championProgress({ id: 'distance', winner: null }, 0, 'me'), /0,1 km/);
  assert.match(championProgress(champion('elevation', 100.5), 90, 'me'), /11 Höhenmeter/);
  assert.match(championProgress(champion('time', 1), 0.5, 'me'), /31 Minuten/);
  assert.match(championProgress(champion('early_bird', 4), 2, 'me'), /2,1 km mit Start vor 08:00 Uhr/);
});

test('handles existing leadership, training day limit and pulse as an absolute score', () => {
  assert.match(championProgress(champion('distance', 10, 'me'), 10, 'me'), /Du führst/);
  assert.match(championProgress(champion('consistency', 7), 3, 'me'), /nur noch Gleichstand/);
  assert.match(championProgress(champion('consistency', 4), 3, 'me'), /2 weiteren Tagen/);
  assert.match(championProgress(champion('heartrate', 160), 140, 'me'), /160 bpm; nötig wäre ein höherer Aktivitätsdurchschnitt/);
  assert.match(championProgress({ id: 'heartrate', winner: null }, 0, 'me'), /aufgezeichnetem Durchschnittspuls/);
});
