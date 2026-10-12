import type { Activity } from '@prisma/client';

export type MaxHrSource = 'profile' | 'age' | 'recorded' | 'default';
export interface Vo2maxEstimate {
  value: number | null;
  sampleCount: number;
  quality: 'insufficient' | 'limited' | 'moderate';
  reason: string;
  maxHr: number;
  maxHrSource: MaxHrSource;
  method: 'oxygen-reserve' | 'hrmax';
  latestSampleDate: string | null;
}

const DAY = 86400000;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Exploratory aggregate-data model, not a validated device algorithm or lab measurement.
 * Flat ACSM running oxygen cost: VO2 = 0.2 * speed(m/min) + 3.5.
 * ACSM metabolic calculations (running >5 mph):
 * https://summitmd.com/pdf/pdf/090626_aps09_970.pdf
 * HRR approximates VO2 RESERVE, not %VO2max (Swain et al., 1998):
 * https://pubmed.ncbi.nlm.nih.gov/9502363/
 * Without resting HR, use Swain et al. (1994) %HRmax = .64 * %VO2max + .37:
 * https://pubmed.ncbi.nlm.nih.gov/8133731/
 * Elevation GAIN is not treadmill grade: exclude hilly routes instead of treating it as grade.
 * Eligibility thresholds and smoothing are product heuristics, not validated accuracy bounds.
 */
export function estimateVo2max(
  activities: Activity[],
  now: Date,
  maxHr: number,
  maxHrSource: MaxHrSource,
  restingHr?: number | null,
): Vo2maxEstimate {
  const useReserve = Number.isFinite(restingHr) && restingHr! >= 35 && restingHr! <= 100 && restingHr! < maxHr - 40;
  const base: Vo2maxEstimate = {
    value: null, sampleCount: 0, quality: 'insufficient',
    reason: 'Mindestens drei geeignete Läufe an unterschiedlichen Tagen in den letzten sechs Wochen erforderlich.',
    maxHr, maxHrSource, method: useReserve ? 'oxygen-reserve' : 'hrmax', latestSampleDate: null,
  };
  if (!Number.isFinite(maxHr) || maxHr < 130 || maxHr > 230) return { ...base, reason: 'Kein plausibler Maximalpuls verfügbar.' };
  const candidates: { value: number; date: Date }[] = [];
  for (const run of activities) {
    const age = now.getTime() - run.startDate.getTime();
    if (!Number.isFinite(age) || age < 0 || age > 42 * DAY || run.sportType !== 'Run') continue;
    const { distance, movingTime, elapsedTime, averageHeartrate: hr, totalElevationGain: gain } = run;
    if (![distance, movingTime, elapsedTime, hr, gain].every(value => typeof value === 'number' && Number.isFinite(value))) continue;
    if (distance < 2000 || movingTime < 900 || elapsedTime < movingTime || elapsedTime > movingTime * 1.15 || gain < 0 || gain / distance > 0.01) continue;
    const speed = distance / (movingTime / 60);
    if (speed < 134 || speed > 300 || hr! < 100 || hr! / maxHr < 0.6 || hr! / maxHr > 0.9) continue;
    const oxygenCost = 0.2 * speed + 3.5;
    const fraction = useReserve ? (hr! - restingHr!) / (maxHr - restingHr!) : (hr! / maxHr - 0.37) / 0.64;
    if (fraction < 0.4 || fraction > 0.9) continue;
    const value = useReserve ? 3.5 + (oxygenCost - 3.5) / fraction : oxygenCost / fraction;
    if (Number.isFinite(value) && value >= 20 && value <= 85) candidates.push({ value, date: run.startDate });
  }
  if (!candidates.length) return base;
  const center = median(candidates.map(sample => sample.value));
  const mad = median(candidates.map(sample => Math.abs(sample.value - center)));
  const samples = candidates.filter(sample => Math.abs(sample.value - center) <= Math.max(center * 0.1, mad * 3));
  const days = new Set(samples.map(sample => sample.date.toISOString().slice(0, 10))).size;
  const latest = new Date(Math.max(...samples.map(sample => sample.date.getTime())));
  const result = { ...base, sampleCount: samples.length, latestSampleDate: latest.toISOString() };
  if (days < 3) return result;
  if (now.getTime() - latest.getTime() > 14 * DAY) return { ...result, reason: 'Keine geeigneten Läufe in den letzten 14 Tagen; Schätzung pausiert.' };
  const weights = samples.map(sample => Math.pow(0.5, (now.getTime() - sample.date.getTime()) / (21 * DAY)));
  const value = samples.reduce((sum, sample, i) => sum + sample.value * weights[i], 0) / weights.reduce((sum, weight) => sum + weight, 0);
  const spread = Math.max(...samples.map(s => s.value)) - Math.min(...samples.map(s => s.value));
  const moderate = days >= 6 && maxHrSource === 'profile' && useReserve && spread / value <= 0.15;
  return {
    ...result, value: Math.round(value * 10) / 10, quality: moderate ? 'moderate' : 'limited',
    reason: moderate ? 'Mehrere konsistente Läufe mit hinterlegtem Maximal- und Ruhepuls. Modell aus Aktivitätsdurchschnitten; nicht individuell validiert.'
      : 'Grobe Modellschätzung aus Aktivitätsdurchschnitten. Wenige Läufe, streuende Werte oder angenommene Pulsparameter begrenzen die Aussagekraft.',
  };
}
