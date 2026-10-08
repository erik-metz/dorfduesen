import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { readCoachBody } = loadTs('lib/training/validation.ts');
const request = body => new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) });

test('coach rejects invalid types, ranges, booleans and calendar dates', async () => {
  for (const body of [[], { goalType: 'unknown' }, { goalType: '5K', weeklyAvailability: 9 },
    { goalType: '5K', weeklyAvailability: true }, { goalType: '5K', includeSundayRun: 'false' },
    { goalType: '5K', targetDate: '2027-02-30' }, { goalType: '5K', targetDistance: 'NaN' }]) {
    await assert.rejects(readCoachBody(request(body), 'plan'));
  }
  await assert.rejects(readCoachBody(request({ maxHeartrate: 100, restingHeartrate: 110 }), 'profile'));
  assert.equal((await readCoachBody(request({ goalType: '5K', weeklyAvailability: 3 }), 'plan')).goalType, '5K');
});

test('model output must be complete and preserve distance and intensity constraints', () => {
  const { validateGeneratedWeeks } = loadTs('lib/training/generated-plan-validation.ts');
  const skeleton = { weeks: [{ weekNumber: 1, phase: 'BASE', daysDistribution: [{ dayOfWeek: 2, workoutType: 'EASY', approximateKm: 5 }] }] };
  const paces = { easyMin: '6:00', easyMax: '7:00' };
  const valid = [{ weekNumber: 1, phase: 'BASE', targetDistance: 5, workouts: [{ dayOfWeek: 2, workoutType: 'EASY', title: 'Lauf', description: 'Locker', targetDistance: 5, targetHrZone: 2, targetPaceMin: '6:00', targetPaceMax: '7:00' }] }];
  validateGeneratedWeeks(valid, skeleton, paces);
  assert.throws(() => validateGeneratedWeeks([], skeleton, paces));
  for (const change of [{ targetDistance: -1 }, { targetHrZone: 5 }, { targetPaceMin: '3:00' }, { dayOfWeek: 7 }]) {
    const changed = structuredClone(valid);
    Object.assign(changed[0].workouts[0], change);
    assert.throws(() => validateGeneratedWeeks(changed, skeleton, paces));
  }
});
