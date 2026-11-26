import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { buildPeriodizationSkeleton } = loadTs('lib/training/periodization.ts');
const { generateAlgorithmicPlan } = loadTs('lib/ai/generator.ts', {
  './xai': {}, '@/lib/coach/models': {}, '@/lib/coach/spend': {},
});
const noRuns = { runCount: 0, averageWeeklyKm: 15, longestRunKm: 6, estimatedVdot: 35 };
const runner = { runCount: 30, averageWeeklyKm: 25, longestRunKm: 12, estimatedVdot: 45 };
const startDate = new Date('2026-11-30T12:00:00Z');
const targetDate = new Date('2027-02-08T12:00:00Z');
const runs = week => week.daysDistribution.filter(day => day.workoutType !== 'REST');

test('a beginner 5 km plan starts with run/walk intervals, not the target distance', () => {
  const skeleton = buildPeriodizationSkeleton({ baseline: noRuns, goalType: '5K', targetDistanceKm: 5, startDate, targetDate, weeklyAvailability: 2 });
  assert.equal(skeleton.mode, 'RUN_WALK');
  assert.equal(skeleton.totalWeeks, 10);
  const first = runs(skeleton.weeks[0]);
  assert.equal(first.length, 2);
  for (const day of first) {
    assert.ok(day.runWalk.repeats > 1 && day.runWalk.runMinutes <= 2, JSON.stringify(day.runWalk));
    assert.ok(day.approximateKm < 3, `first session ${day.approximateKm} km`);
  }
  // Continuous running time never shrinks outside the final goal week.
  let previous = 0;
  for (const week of skeleton.weeks.slice(0, -1)) {
    const s = runs(week)[0].runWalk;
    assert.ok(s.repeats * s.runMinutes >= previous - 1, week.focusTitle);
    previous = s.repeats * s.runMinutes;
  }
  const goal = runs(skeleton.weeks.at(-1)).find(day => day.runWalk.goalRunKm);
  assert.equal(goal.runWalk.goalRunKm, 5);
  assert.equal(goal.dayOfWeek, 0);

  const weeks = generateAlgorithmicPlan({ skeleton, goalType: '5K', paces: {}, zones: [], athleteBaseline: noRuns, planTitle: '5 km' });
  const firstWorkout = weeks[0].workouts.find(w => w.dayOfWeek === 2);
  assert.match(firstWorkout.title, /Lauf-Geh-Intervalle/);
  assert.equal(firstWorkout.targetPaceMin, undefined);
  assert.equal(weeks[0].workouts.find(w => w.dayOfWeek === 0).isFlexible, false);
});

test('stated ability overrides the data and caps beginner sessions at three per week', () => {
  const skeleton = buildPeriodizationSkeleton({ baseline: runner, goalType: '5K', startDate, targetDate, weeklyAvailability: 5, currentRunMinutes: 5 });
  assert.equal(skeleton.mode, 'RUN_WALK');
  assert.equal(runs(skeleton.weeks[0]).length, 3);
  assert.equal(buildPeriodizationSkeleton({ baseline: noRuns, goalType: '5K', startDate, targetDate, currentRunMinutes: 30 }).mode, 'STANDARD');
});

test('regular runners and long-distance goals keep the standard plan', () => {
  assert.equal(buildPeriodizationSkeleton({ baseline: runner, goalType: '5K', startDate, targetDate }).mode, 'STANDARD');
  assert.equal(buildPeriodizationSkeleton({ baseline: noRuns, goalType: 'HALF_MARATHON', startDate, targetDate }).mode, 'STANDARD');
});
