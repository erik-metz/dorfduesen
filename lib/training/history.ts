import type { Activity, HealthMetric } from '@prisma/client';
import { baselineFromActivities } from './baseline-calculation';
import { getTrainingPaces } from './vdot';
import { calculateHeartRateZones } from './zones';

/** Reconstructed estimates, never historical measurements or past manual overrides. */
export function calculateFitnessHistory(userId: string, activities: Activity[], metrics: HealthMetric[], now: Date) {
  return Array.from({ length: 26 }, (_, index) => {
    const date = new Date(now.getTime() - (25 - index) * 7 * 86400000);
    const priorMetrics = metrics.filter(m => m.date <= date).sort((a, b) => b.date.getTime() - a.date.getTime());
    const restingHeartrate = priorMetrics.find(m => m.restingHeartrate !== null)?.restingHeartrate ?? null;
    const weightKg = priorMetrics.find(m => m.weightKg !== null)?.weightKg ?? null;
    const baseline = baselineFromActivities(userId, activities, { maxHeartrate: null, restingHeartrate }, date);
    const maxHr = baseline.measuredMaxHr ?? 185;
    return {
      date: date.toISOString(),
      baseline,
      vdot: baseline.hasSufficientData ? baseline.estimatedVdot : null,
      maxHr,
      maxHrSource: baseline.measuredMaxHr ? 'Aufgezeichneter Höchstpuls' : 'Standardannahme',
      restingHeartrate,
      weightKg,
      paces: baseline.hasSufficientData ? getTrainingPaces(baseline.estimatedVdot) : null,
      zones: calculateHeartRateZones(maxHr, restingHeartrate ?? undefined),
    };
  });
}
export type FitnessHistoryPoint = ReturnType<typeof calculateFitnessHistory>[number];
