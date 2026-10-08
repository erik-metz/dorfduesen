import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { weekRange, monthRange, berlinMidnight } = loadTs('lib/time.ts');

test('Berlin calendar weeks cover DST changes without counting the next week', () => {
  const spring = weekRange(new Date('2026-03-29T12:00:00Z'));
  assert.equal(spring.key, '2026-03-23');
  assert.equal(spring.start.toISOString(), '2026-03-22T23:00:00.000Z');
  assert.equal(spring.end.toISOString(), '2026-03-29T22:00:00.000Z');
  assert.equal((spring.end - spring.start) / 3600000, 167);
  const autumn = weekRange(new Date('2026-10-25T12:00:00Z'));
  assert.equal((autumn.end - autumn.start) / 3600000, 169);
  assert.equal(weekRange(spring.end).key, '2026-03-30');
  assert.equal(weekRange(new Date(spring.end - 1)).key, '2026-03-23');
});

test('previous month crosses year boundaries in Berlin time', () => {
  const current = monthRange(new Date('2025-12-31T23:05:00Z'));
  assert.equal(current.key, '2026-01');
  assert.equal(monthRange(new Date(current.start - 1)).key, '2025-12');
  assert.equal(berlinMidnight('2026-07-01').toISOString(), '2026-06-30T22:00:00.000Z');
});
