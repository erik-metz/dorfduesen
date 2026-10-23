import type { Activity, MobileHealthRecord } from '@prisma/client';

type ActivityForMatching = Pick<Activity, 'id' | 'stravaId' | 'name' | 'sportType' | 'startDate' | 'elapsedTime' | 'distance'>;
type HealthRecordForOverview = Pick<MobileHealthRecord, 'id' | 'provider' | 'recordId' | 'recordType' | 'startAt' | 'endAt' | 'value' | 'sourceName' | 'sourceId'>;

export type HealthSignal = {
  value: number;
  unit: string;
  measuredAt: string;
  provider: string;
  sourceName: string | null;
};

const json = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nestedNumber(value: unknown, keys: string[]): number | null {
  let current = value;
  for (const key of keys) current = json(current)[key];
  return finite(current);
}

function signalValue(record: HealthRecordForOverview): { value: number; unit: string } | null {
  const value = json(record.value);
  const quantity = finite(value.quantity);
  switch (record.recordType) {
    case 'vo2_max': {
      const result = quantity ?? finite(value.vo2MillilitersPerMinuteKilogram);
      return result === null ? null : { value: result, unit: 'ml/kg/min' };
    }
    case 'resting_heart_rate': {
      const result = quantity ?? finite(value.beatsPerMinute);
      return result === null ? null : { value: result, unit: 'bpm' };
    }
    case 'heart_rate_variability': {
      const result = quantity ?? finite(value.heartRateVariabilityMillis);
      return result === null ? null : { value: result, unit: 'ms' };
    }
    case 'body_mass': {
      const kg = quantity === null ? nestedNumber(value, ['weight', 'inKilograms']) ?? nestedNumber(value, ['mass', 'inKilograms']) : quantity;
      if (kg === null) return null;
      const unit = typeof value.unit === 'string' ? value.unit.toLowerCase() : '';
      if (unit === 'g' || unit === 'gram') return { value: kg / 1000, unit: 'kg' };
      if (unit === 'lb' || unit === 'lbs' || unit === 'pound') return { value: kg * 0.45359237, unit: 'kg' };
      return { value: kg, unit: 'kg' };
    }
    case 'body_fat_percentage': {
      const result = quantity ?? finite(value.percentage);
      if (result === null) return null;
      return { value: result <= 1 ? result * 100 : result, unit: '%' };
    }
    case 'oxygen_saturation': {
      const result = quantity ?? finite(value.percentage);
      if (result === null) return null;
      return { value: result <= 1 ? result * 100 : result, unit: '%' };
    }
    case 'respiratory_rate': {
      const result = quantity ?? finite(value.rate);
      return result === null ? null : { value: result, unit: 'breaths/min' };
    }
    default:
      return null;
  }
}

function getLatestSignal(records: HealthRecordForOverview[], recordTypes: string[]): HealthSignal | null {
  for (const record of records) {
    if (!recordTypes.includes(record.recordType)) continue;
    const normalized = signalValue(record);
    if (normalized) return {
      ...normalized,
      measuredAt: record.startAt.toISOString(),
      provider: record.provider,
      sourceName: record.sourceName,
    };
  }
  return null;
}

type SportFamily = 'RUN' | 'RIDE' | 'WALK' | 'SWIM' | 'OTHER';

function stravaSport(sportType: string): SportFamily {
  if (['Run', 'TrailRun', 'VirtualRun'].includes(sportType)) return 'RUN';
  if (['Ride', 'VirtualRide', 'EBikeRide', 'MountainBikeRide', 'GravelRide'].includes(sportType)) return 'RIDE';
  if (['Walk', 'Hike'].includes(sportType)) return 'WALK';
  if (['Swim', 'OpenWaterSwim'].includes(sportType)) return 'SWIM';
  return 'OTHER';
}

function healthSport(record: HealthRecordForOverview): SportFamily {
  const value = json(record.value);
  const raw = value.exerciseType ?? value.activityType;
  if (typeof raw === 'string') {
    const text = raw.toLowerCase();
    if (text.includes('run')) return 'RUN';
    if (text.includes('cycl') || text.includes('bik')) return 'RIDE';
    if (text.includes('walk') || text.includes('hik')) return 'WALK';
    if (text.includes('swim')) return 'SWIM';
  }
  const numericType = finite(raw);
  if (record.provider === 'APPLE_HEALTH') {
    if (numericType === 37) return 'RUN';
    if (numericType === 13) return 'RIDE';
    if (numericType === 52) return 'WALK';
    if (numericType === 46) return 'SWIM';
  }
  if (record.provider === 'HEALTH_CONNECT') {
    if ([56, 57].includes(numericType ?? -1)) return 'RUN';
    if ([8, 9].includes(numericType ?? -1)) return 'RIDE';
    if (numericType === 79) return 'WALK';
    if ([73, 74].includes(numericType ?? -1)) return 'SWIM';
  }
  return 'OTHER';
}

function healthWorkoutDuration(record: HealthRecordForOverview): number | null {
  const value = json(record.value);
  const duration = finite(value.duration);
  if (duration !== null && duration > 0) return duration;
  if (record.endAt && record.endAt > record.startAt) return (record.endAt.getTime() - record.startAt.getTime()) / 1000;
  return null;
}

export function buildHealthOverview(records: HealthRecordForOverview[], activities: ActivityForMatching[], now: Date) {
  const sortedRecords = [...records].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  const workouts = sortedRecords.filter(record => record.recordType === 'workout');
  const availableActivities = [...activities].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const matchedActivityIds = new Set<string>();
  const activityMatches = [...workouts].reverse().map(record => {
    const family = healthSport(record);
    const duration = healthWorkoutDuration(record);
    const candidates = availableActivities.map(activity => {
      if (matchedActivityIds.has(activity.id) || family === 'OTHER') return null;
      const activityFamily = stravaSport(activity.sportType);
      const startDeltaSeconds = Math.abs(activity.startDate.getTime() - record.startAt.getTime()) / 1000;
      if (startDeltaSeconds > 8 * 60) return null;
      if (activityFamily !== family) return null;
      if (duration !== null && Math.abs(activity.elapsedTime - duration) > Math.max(150, duration * 0.2)) return null;
      return { activity, startDeltaSeconds };
    }).filter((candidate): candidate is { activity: ActivityForMatching; startDeltaSeconds: number } => candidate !== null)
      .sort((a, b) => a.startDeltaSeconds - b.startDeltaSeconds);
    const match = candidates[0];
    if (match) matchedActivityIds.add(match.activity.id);
    return {
      healthRecordId: record.id,
      provider: record.provider,
      sourceName: record.sourceName,
      startAt: record.startAt.toISOString(),
      sport: family,
      status: match ? 'already_in_strava' as const : 'health_only' as const,
      strava: match ? { id: match.activity.stravaId, name: match.activity.name, sportType: match.activity.sportType, startAt: match.activity.startDate.toISOString() } : null,
    };
  });

  const count = (types: string[]) => sortedRecords.filter(record => types.includes(record.recordType)).length;
  const providers = [...new Set(sortedRecords.map(record => record.provider))];
  return {
    from: new Date(now.getTime() - 182 * 86400000).toISOString(),
    to: now.toISOString(),
    recordCount: sortedRecords.length,
    providers,
    signals: {
      deviceVo2max: getLatestSignal(sortedRecords, ['vo2_max']),
      restingHeartRate: getLatestSignal(sortedRecords, ['resting_heart_rate']),
      heartRateVariability: getLatestSignal(sortedRecords, ['heart_rate_variability']),
      weight: getLatestSignal(sortedRecords, ['body_mass']),
      bodyFat: getLatestSignal(sortedRecords, ['body_fat_percentage']),
      oxygenSaturation: getLatestSignal(sortedRecords, ['oxygen_saturation']),
      respiratoryRate: getLatestSignal(sortedRecords, ['respiratory_rate']),
    },
    recordCounts: {
      workouts: workouts.length,
      sleep: count(['sleep']),
      steps: count(['step_count']),
      heartRateSamples: count(['heart_rate']),
    },
    activityMatches,
    matchedWorkoutCount: activityMatches.filter(match => match.status === 'already_in_strava').length,
    healthOnlyWorkoutCount: activityMatches.filter(match => match.status === 'health_only').length,
  };
}
