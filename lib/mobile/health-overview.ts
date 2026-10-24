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

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(date: Date) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function recordNumber(record: HealthRecordForOverview) {
  const value = json(record.value);
  if (record.recordType === 'step_count') return finite(value.quantity) ?? finite(value.count);
  const signal = signalValue(record);
  return signal?.value ?? null;
}

function sleepStageDuration(record: HealthRecordForOverview) {
  const value = json(record.value);
  if (Array.isArray(value.stages)) {
    return value.stages.reduce((seconds, rawStage) => {
      const stage = json(rawStage);
      const stageType = finite(stage.stage);
      if (![2, 4, 5, 6].includes(stageType ?? -1)) return seconds;
      const start = typeof stage.startTime === 'string' ? new Date(stage.startTime).getTime() : NaN;
      const end = typeof stage.endTime === 'string' ? new Date(stage.endTime).getTime() : NaN;
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? seconds + (end - start) / 1000 : seconds;
    }, 0);
  }
  const stageType = finite(value.value);
  if (![1, 3, 4, 5].includes(stageType ?? -1) || !record.endAt || record.endAt <= record.startAt) return 0;
  return (record.endAt.getTime() - record.startAt.getTime()) / 1000;
}

function dailyValues(records: HealthRecordForOverview[], type: string) {
  const grouped = new Map<string, Map<string, number[]>>();
  for (const record of records) {
    if (record.recordType !== type) continue;
    const day = utcDay(record.endAt ?? record.startAt);
    const source = record.sourceId ?? record.provider;
    let bySource = grouped.get(day);
    if (!bySource) { bySource = new Map(); grouped.set(day, bySource); }
    const values = bySource.get(source) ?? [];
    const value = type === 'sleep' ? sleepStageDuration(record) / 3600 : recordNumber(record);
    if (value !== null && value > 0) values.push(value);
    bySource.set(source, values);
  }
  const daily = new Map<string, number>();
  for (const [day, bySource] of grouped) {
    const sourceTotals = [...bySource.values()].map(values => type === 'sleep' || type === 'step_count' ? values.reduce((sum, value) => sum + value, 0) : median(values) ?? 0);
    const value = type === 'sleep' || type === 'step_count' ? Math.max(...sourceTotals, 0) : median(sourceTotals.filter(item => item > 0)) ?? 0;
    if (value > 0) daily.set(day, value);
  }
  return daily;
}

function weeklyHealthTrends(records: HealthRecordForOverview[], now: Date) {
  const currentWeek = new Date(`${mondayOf(now)}T00:00:00.000Z`);
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(currentWeek.getTime() - (11 - index) * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const inWeek = (date: Date) => date >= start && date < end;
    const recordsInWeek = records.filter(record => inWeek(record.recordType === 'sleep' ? record.endAt ?? record.startAt : record.startAt));
    const averages = (daily: Map<string, number>) => {
      const values = [...daily].filter(([day]) => {
        const date = new Date(`${day}T00:00:00.000Z`);
        return inWeek(date);
      }).map(([, value]) => value);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    const medianMetric = (type: string) => {
      const daily = dailyValues(recordsInWeek, type);
      return median([...daily.values()]);
    };
    const vo2 = recordsInWeek.filter(record => record.recordType === 'vo2_max').map(record => ({ record, value: signalValue(record)?.value ?? null })).filter((item): item is { record: HealthRecordForOverview; value: number } => item.value !== null).sort((a, b) => b.record.startAt.getTime() - a.record.startAt.getTime())[0]?.value ?? null;
    return {
      weekStart: mondayOf(start),
      deviceVo2max: vo2,
      restingHeartRate: medianMetric('resting_heart_rate'),
      heartRateVariability: medianMetric('heart_rate_variability'),
      weight: medianMetric('body_mass'),
      stepsPerDay: averages(dailyValues(recordsInWeek, 'step_count')),
      sleepHours: averages(dailyValues(recordsInWeek, 'sleep')),
    };
  });
  return weeks;
}

function distanceMeters(value: unknown): number | null {
  const object = json(value);
  const nested = object.totalDistance ?? object.distance;
  const meters = nestedNumber(nested, ['inMeters']);
  if (meters !== null) return meters;
  const quantity = finite(object.quantity) ?? finite(nestedNumber(nested, ['quantity'])) ?? finite(object.value);
  if (quantity === null) return null;
  const unitValue = typeof object.unit === 'string' ? object.unit : typeof json(nested).unit === 'string' ? String(json(nested).unit) : '';
  const unit = unitValue.toLowerCase();
  if (unit.includes('km') || unit.includes('kilometer')) return quantity * 1000;
  if (unit === 'mi' || unit.includes('mile')) return quantity * 1609.344;
  if (unit === 'ft' || unit.includes('foot')) return quantity * 0.3048;
  if (!unit || unit === 'm' || unit.includes('meter')) return quantity;
  return null;
}

function heartRateSamplesForWorkout(record: HealthRecordForOverview, heartRateRecords: HealthRecordForOverview[]) {
  const start = record.startAt.getTime();
  const end = record.endAt?.getTime() ?? start + (healthWorkoutDuration(record) ?? 0) * 1000;
  const samples: number[] = [];
  for (const item of heartRateRecords) {
    if (item.provider !== record.provider) continue;
    if (record.sourceId && item.sourceId && record.sourceId !== item.sourceId) continue;
    const value = json(item.value);
    const quantity = finite(value.quantity);
    const sampleTime = item.startAt.getTime();
    if (quantity !== null) {
      if (sampleTime >= start && sampleTime <= end && quantity >= 35 && quantity <= 230) samples.push(quantity);
      continue;
    }
    if (!Array.isArray(value.samples)) continue;
    for (const rawSample of value.samples) {
      const sample = json(rawSample);
      const bpm = finite(sample.beatsPerMinute);
      const time = typeof sample.time === 'string' ? new Date(sample.time).getTime() : sampleTime;
      if (bpm !== null && time >= start && time <= end && bpm >= 35 && bpm <= 230) samples.push(bpm);
    }
  }
  return samples;
}

function workoutDistanceMeters(record: HealthRecordForOverview, distanceRecords: HealthRecordForOverview[]) {
  const value = json(record.value);
  const direct = distanceMeters({ totalDistance: value.totalDistance });
  if (direct !== null && direct > 0) return direct;
  const family = healthSport(record);
  const workoutStart = record.startAt.getTime();
  const workoutEnd = record.endAt?.getTime() ?? workoutStart + (healthWorkoutDuration(record) ?? 0) * 1000;
  if (workoutEnd <= workoutStart) return null;
  const compatible = distanceRecords.filter(item => {
    if (item.provider !== record.provider || item.startAt.getTime() < workoutStart - 60_000 || item.startAt.getTime() > workoutEnd + 60_000) return false;
    if (family === 'RUN' || family === 'WALK') return ['distance', 'walking_running_distance'].includes(item.recordType);
    if (family === 'RIDE') return ['distance', 'cycling_distance'].includes(item.recordType);
    if (family === 'SWIM') return ['distance', 'swimming_distance'].includes(item.recordType);
    return false;
  });
  const grouped = new Map<string, number>();
  for (const item of compatible) {
    const itemStart = item.startAt.getTime();
    const itemEnd = item.endAt?.getTime() ?? itemStart;
    const overlap = Math.max(0, Math.min(workoutEnd, itemEnd) - Math.max(workoutStart, itemStart));
    const interval = Math.max(1, itemEnd - itemStart);
    const startsInside = itemStart >= workoutStart - 60_000 && itemStart <= workoutEnd + 60_000;
    if (!startsInside || (itemEnd > itemStart && overlap / interval < 0.5)) continue;
    const meters = distanceMeters(item.value);
    if (meters === null || meters <= 0) continue;
    const source = item.sourceId ?? item.sourceName ?? item.provider;
    grouped.set(source, (grouped.get(source) ?? 0) + meters);
  }
  return Math.max(...grouped.values(), 0) || null;
}

function buildHealthOnlyActivities(userId: string, records: HealthRecordForOverview[], matches: ReturnType<typeof buildHealthOverview>['activityMatches']): Activity[] {
  const healthById = new Map(records.map(record => [record.id, record]));
  const heartRateRecords = records.filter(record => record.recordType === 'heart_rate');
  const distanceRecords = records.filter(record => ['distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance'].includes(record.recordType));
  const additional: Activity[] = [];

  for (const match of matches) {
    if (match.strava) continue;
    const record = healthById.get(match.healthRecordId);
    if (!record) continue;
    const family = healthSport(record);
    const distance = workoutDistanceMeters(record, distanceRecords) ?? 0;
    const duration = healthWorkoutDuration(record);
    // Manual Health workouts can have a duration but no distance. Keep them
    // visible in the activity log while leaving their mileage at zero.
    if (family === 'OTHER' || duration === null || duration < 60) continue;
    const sportType = family === 'RUN' ? 'Run' : family === 'RIDE' ? 'Ride' : family === 'WALK' ? 'Walk' : 'Swim';
    const value = json(record.value);
    const totalElevationGain = finite(value.totalElevationGain) ?? 0;
    const sourceLabel = record.provider === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect';
    const heartRates = heartRateSamplesForWorkout(record, heartRateRecords);
    const averageHeartrate = heartRates.length ? heartRates.reduce((sum, item) => sum + item, 0) / heartRates.length : null;
    const maxHeartrate = heartRates.length ? Math.max(...heartRates) : null;
    additional.push({
      id: `health:${record.id}`,
      userId,
      stravaId: `health:${userId}:${record.provider}:${record.recordId}`,
      name: typeof value.title === 'string' && value.title ? value.title : `${sportType} · ${sourceLabel}`,
      distance,
      extractedDistance: null,
      manualDistance: null,
      movingTime: Math.round(duration),
      elapsedTime: Math.round(duration),
      totalElevationGain,
      sportType,
      startDate: record.startAt,
      startDateLocal: record.startAt,
      timezone: null,
      averageSpeed: distance > 0 ? distance / duration : null,
      maxSpeed: null,
      averageHeartrate,
      maxHeartrate,
      kudosCount: 0,
      commentCount: 0,
      achievementCount: 0,
      summaryPolyline: null,
      detailJson: null,
      syncedAt: record.startAt,
    });
  }
  return additional;
}

/** Prefer Health measurements for matched sessions and add Health-only sessions. */
export function buildCanonicalActivities(userId: string, records: HealthRecordForOverview[], activities: Activity[], now: Date): Activity[] {
  const matches = buildHealthOverview(records, activities, now).activityMatches;
  const healthById = new Map(records.map(record => [record.id, record]));
  const heartRateRecords = records.filter(record => record.recordType === 'heart_rate');
  const distanceRecords = records.filter(record => ['distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance'].includes(record.recordType));
  const enrichment = new Map<string, Partial<Pick<Activity, 'distance' | 'movingTime' | 'elapsedTime' | 'averageSpeed' | 'averageHeartrate' | 'maxHeartrate' | 'totalElevationGain'>>>();

  for (const match of matches) {
    if (!match.strava) continue;
    const record = healthById.get(match.healthRecordId);
    if (!record) continue;
    const heartRates = heartRateSamplesForWorkout(record, heartRateRecords);
    const averageHeartrate = heartRates.length ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length : null;
    const maxHeartrate = heartRates.length ? Math.max(...heartRates) : null;
    const healthDistance = workoutDistanceMeters(record, distanceRecords);
    const healthDuration = healthWorkoutDuration(record);
    const directAverageHeartrate = finite(json(record.value).averageHeartRate) ?? finite(json(record.value).averageHeartrate);
    const directMaxHeartrate = finite(json(record.value).maxHeartRate) ?? finite(json(record.value).maxHeartrate);
    const healthValues: Partial<Pick<Activity, 'distance' | 'movingTime' | 'elapsedTime' | 'averageSpeed' | 'averageHeartrate' | 'maxHeartrate' | 'totalElevationGain'>> = {};
    if (healthDistance !== null && healthDistance > 0) healthValues.distance = healthDistance;
    if (healthDuration !== null && healthDuration > 0) {
      healthValues.movingTime = Math.round(healthDuration);
      healthValues.elapsedTime = Math.round(healthDuration);
      if (healthDistance !== null && healthDistance > 0) healthValues.averageSpeed = healthDistance / healthDuration;
    }
    const healthAverageHeartrate = averageHeartrate ?? directAverageHeartrate;
    const healthMaxHeartrate = maxHeartrate ?? directMaxHeartrate;
    if (healthAverageHeartrate !== null) healthValues.averageHeartrate = healthAverageHeartrate;
    if (healthMaxHeartrate !== null) healthValues.maxHeartrate = healthMaxHeartrate;
    const healthElevation = finite(json(record.value).totalElevationGain);
    if (healthElevation !== null && healthElevation >= 0) healthValues.totalElevationGain = healthElevation;
    if (Object.keys(healthValues).length) enrichment.set(match.strava.id, healthValues);
  }

  const enrichedStrava = activities.map(activity => {
    const health = enrichment.get(activity.stravaId);
    if (!health) return activity;
    // A matched workout remains one canonical activity. Health values win when
    // the OS supplied them; Strava fills only fields Health did not provide.
    return { ...activity, ...health };
  });
  return [...enrichedStrava, ...buildHealthOnlyActivities(userId, records, matches)];
}

export function buildHealthOnlyCanonicalActivities(userId: string, records: HealthRecordForOverview[], stravaActivities: ActivityForMatching[], now: Date): Activity[] {
  const matches = buildHealthOverview(records, stravaActivities, now).activityMatches;
  return buildHealthOnlyActivities(userId, records, matches);
}

/** Import measured weight and resting pulse into the historical read-model, retaining manual entries. */
export function healthMetricHistory(records: HealthRecordForOverview[], userId: string) {
  return records.flatMap(record => {
    const normalized = signalValue(record);
    if (!normalized) return [];
    const weightKg = record.recordType === 'body_mass' && normalized.value >= 25 && normalized.value <= 350 ? normalized.value : null;
    const restingHeartrate = record.recordType === 'resting_heart_rate' && normalized.value >= 25 && normalized.value <= 120 ? Math.round(normalized.value) : null;
    if (weightKg === null && restingHeartrate === null) return [];
    return [{ id: `health:${record.id}`, userId, date: record.startAt, weightKg, restingHeartrate, notes: `Health-Messung · ${record.sourceName ?? record.provider}` }];
  });
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
    weeklyTrends: weeklyHealthTrends(sortedRecords, now),
    activityMatches,
    matchedWorkoutCount: activityMatches.filter(match => match.status === 'already_in_strava').length,
    healthOnlyWorkoutCount: activityMatches.filter(match => match.status === 'health_only').length,
  };
}
