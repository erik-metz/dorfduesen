import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { highlightCards, highlightHint } = loadTs('lib/arena/highlight-presentation.ts');
const athlete = userId => ({ userId, name: userId, profile: null, value: 2, formattedValue: '2 Tage aktiv' });
const title = (id, ids, kind = 'recognition') => ({ id, kind, recipients: ids.map(athlete), winner: kind ? null : athlete(ids[0]) });
const personal = { userId: 'me', values: {}, achievements: [], activeDays: 1, previousDays: [2, 2], averageDays: 1, historyAvailable: true, currentGoal: null };

test('six category cards preserve winners and distribute personal spotlights without losing other recipients', () => {
  const cards = highlightCards([
    title('run_distance', ['fast'], null), title('ride_distance', ['fast'], null),
    title('stayed_active', ['fast', 'steady']), title('routine', ['fast', 'steady', 'regular']),
    title('goal', []), title('progress', ['regular', 'new']),
  ]);
  assert.equal(cards.length, 6);
  assert.equal(cards[0].featured.userId, 'fast');
  assert.equal(cards.find(c => c.champion.id === 'stayed_active').featured.userId, 'steady');
  assert.equal(cards.find(c => c.champion.id === 'routine').featured.userId, 'regular');
  assert.equal(cards.find(c => c.champion.id === 'progress').featured.userId, 'new');
  assert.equal(cards.find(c => c.champion.id === 'stayed_active').recipients.length, 2);
  assert.equal(cards.at(-1).champion.id, 'goal');
  assert.equal(cards.at(-1).featured, undefined);
});

test('personal incentives distinguish achieved, reachable and unavailable goals', () => {
  assert.equal(highlightHint(title('stayed_active', []), personal), 'Noch einmal raus. Dann verliert das Sofa.');
  assert.match(highlightHint(title('stayed_active', ['me']), personal), /Sofa besiegt/);
  assert.match(highlightHint(title('routine', []), personal), /Noch 1 Tag aktiv/);
  assert.match(highlightHint(title('routine', []), { ...personal, previousDays: [0, 2] }), /Serie läuft an/);
  assert.match(highlightHint(title('progress', []), personal), /Noch 1 aktiver Tag/);
  assert.match(highlightHint(title('progress', []), { ...personal, historyAvailable: false }), /Erst ankommen/);
  assert.match(highlightHint(title('goal', []), personal), /Dashboard/);
  assert.match(highlightHint(title('goal', []), { ...personal, currentGoal: 3 }), /Noch 2 Tage/);
});
