import type { FitnessHistoryPoint } from './history';

export type HistoryMetric = 'vdot' | 'vo2max' | 'paces' | 'zones' | 'volume' | 'acwr' | 'maxHr' | 'restingHr' | 'weight';
export interface HistoryValue { min: number; max: number }
export interface HistorySeries { id: string; label: string; color: string; values: (HistoryValue | null)[] }
export const HISTORY_METRICS: Record<HistoryMetric, { label: string; unit: string }> = {
  vdot: { label: 'VDOT', unit: 'VDOT' }, vo2max: { label: 'VO₂max', unit: 'ml/kg/min' },
  paces: { label: 'Trainingspaces', unit: 'min/km' }, zones: { label: 'Pulszonen', unit: 'bpm' },
  volume: { label: 'Wochenumfang', unit: 'km/Woche' }, acwr: { label: 'Belastung (ACWR)', unit: 'ACWR' },
  maxHr: { label: 'Maximalpuls', unit: 'bpm' }, restingHr: { label: 'Ruhepuls', unit: 'bpm' }, weight: { label: 'Gewicht', unit: 'kg' },
};
const single = (value: number | null): HistoryValue | null => value !== null && Number.isFinite(value) ? { min: value, max: value } : null;
function paceSeconds(pace: string): number {
  const [minutes, seconds] = pace.split(':').map(Number);
  return minutes * 60 + seconds;
}
export function formatHistoryValue(value: number, metric: HistoryMetric): string {
  if (metric === 'paces') {
    const total = Math.round(value);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: metric === 'acwr' ? 2 : 1 }).format(value);
}
export function historySeries(points: FitnessHistoryPoint[], metric: HistoryMetric): HistorySeries[] {
  if (metric === 'paces') {
    return [
      ['easy', 'Easy', '#34d399'], ['marathon', 'Marathon', '#fbbf24'], ['threshold', 'Schwelle', '#fb923c'],
      ['interval', 'Intervall', '#fb7185'], ['repetition', 'Wiederholung', '#a78bfa'],
    ].map(([id, label, color]) => ({ id, label, color, values: points.map(point => {
      if (!point.paces) return null;
      const paces = point.paces;
      const key = id as 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';
      const min = paceSeconds(paces[`${key}Min`]);
      const max = paceSeconds(paces[`${key}Max`]);
      return Number.isFinite(min) && Number.isFinite(max) ? { min: Math.min(min, max), max: Math.max(min, max) } : null;
    }) }));
  }
  if (metric === 'zones') {
    return ['#38bdf8', '#34d399', '#fbbf24', '#fb923c', '#fb7185'].map((color, index) => ({
      id: `zone-${index + 1}`, label: `Zone ${index + 1}`, color,
      values: points.map(point => {
        const zone = point.zones.find(zone => zone.zone === index + 1);
        return zone ? { min: zone.minHr, max: zone.maxHr } : null;
      }),
    }));
  }
  return [{ id: metric, label: HISTORY_METRICS[metric].label, color: metric === 'vo2max' ? '#22d3ee' : '#fb923c', values: points.map(point => {
    switch (metric) {
      case 'vdot': return single(point.vdot);
      case 'vo2max': return single(point.vo2max.value);
      case 'volume': return single(point.baseline.runCount ? point.baseline.averageWeeklyKm : null);
      case 'acwr': return single(point.baseline.runCount ? point.baseline.acwr : null);
      case 'maxHr': return single(point.maxHr);
      case 'restingHr': return single(point.restingHeartrate);
      case 'weight': return single(point.weightKg);
    }
  }) }];
}

/** Split at missing values so the chart never connects across weeks without data. */
export function continuousSegments(values: (HistoryValue | null)[]): number[][] {
  const segments: number[][] = [];
  values.forEach((value, index) => {
    if (!value) return;
    if (index === 0 || !values[index - 1]) segments.push([]);
    segments[segments.length - 1].push(index);
  });
  return segments;
}
