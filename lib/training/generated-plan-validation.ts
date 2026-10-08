import type { PeriodizationPlanSkeleton } from './periodization';
import type { TrainingPaces } from './vdot';
import type { GeneratedWeek } from '../ai/generator';

/** Model output is untrusted: accept only complete plans within the computed framework. */
export function validateGeneratedWeeks(value: unknown, skeleton: PeriodizationPlanSkeleton, paces: TrainingPaces): asserts value is GeneratedWeek[] {
  if (!Array.isArray(value) || value.length !== skeleton.weeks.length) throw new Error('Incomplete generated weeks');
  const seconds = (pace: unknown) => {
    if (typeof pace !== 'string' || !/^\d{1,2}:[0-5]\d$/.test(pace)) throw new Error('Invalid pace');
    const [m, s] = pace.split(':').map(Number); return m * 60 + s;
  };
  value.forEach((week, index) => {
    const expected = skeleton.weeks[index];
    if (!week || week.weekNumber !== expected.weekNumber || week.phase !== expected.phase || !Array.isArray(week.workouts)) throw new Error('Invalid generated week');
    const days = new Set<number>();
    let distance = 0;
    for (const workout of week.workouts) {
      if (!workout || !Number.isInteger(workout.dayOfWeek) || days.has(workout.dayOfWeek)) throw new Error('Invalid or duplicate workout day');
      days.add(workout.dayOfWeek);
      const day = expected.daysDistribution.find(d => d.dayOfWeek === workout.dayOfWeek);
      if (!day || workout.workoutType !== day.workoutType || (workout.sportType && !['Run', 'Rest'].includes(workout.sportType))) throw new Error('Workout outside framework');
      if (typeof workout.title !== 'string' || workout.title.length === 0 || workout.title.length > 200 || typeof workout.description !== 'string' || workout.description.length > 5000) throw new Error('Invalid workout text');
      if (day.workoutType === 'REST') {
        if (workout.targetDistance && workout.targetDistance !== 0) throw new Error('Rest day with distance');
        continue;
      }
      if (typeof workout.targetDistance !== 'number' || !Number.isFinite(workout.targetDistance) || Math.abs(workout.targetDistance - day.approximateKm) > 0.2) throw new Error('Invalid workout distance');
      distance += workout.targetDistance;
      const quality = day.workoutType === 'TEMPO' ? [paces.thresholdMin, paces.thresholdMax, 4] : day.workoutType === 'INTERVAL' ? [paces.intervalMin, paces.intervalMax, 5] : [paces.easyMin, paces.easyMax, 2];
      if (workout.targetHrZone !== quality[2] || seconds(workout.targetPaceMin) < seconds(quality[0]) - 5 || seconds(workout.targetPaceMax) > seconds(quality[1]) + 5 || seconds(workout.targetPaceMin) > seconds(workout.targetPaceMax)) throw new Error('Workout intensity outside framework');
      if (workout.targetDurationMinutes !== undefined && (!Number.isFinite(workout.targetDurationMinutes) || workout.targetDurationMinutes <= 0 || workout.targetDurationMinutes > 1440)) throw new Error('Invalid workout duration');
    }
    if (expected.daysDistribution.some(d => d.workoutType !== 'REST' && !days.has(d.dayOfWeek))) throw new Error('Missing workout');
    const expectedDistance = expected.daysDistribution.reduce((sum, day) => sum + day.approximateKm, 0);
    if (!Number.isFinite(week.targetDistance) || Math.abs(week.targetDistance - expectedDistance) > 0.5 || Math.abs(distance - expectedDistance) > 0.5) throw new Error('Invalid weekly volume');
  });
}
