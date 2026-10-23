import { Platform } from 'react-native';
export type HealthRecordType =
  | 'workout' | 'step_count' | 'distance' | 'walking_running_distance' | 'cycling_distance' | 'swimming_distance' | 'floors_climbed'
  | 'active_energy' | 'basal_energy' | 'total_energy' | 'exercise_time' | 'stand_time' | 'heart_rate' | 'resting_heart_rate'
  | 'walking_heart_rate_average' | 'heart_rate_variability' | 'oxygen_saturation' | 'respiratory_rate' | 'body_temperature'
  | 'blood_pressure' | 'body_mass' | 'body_fat_percentage' | 'lean_body_mass' | 'height' | 'body_water_mass'
  | 'bone_mass' | 'vo2_max' | 'blood_glucose' | 'sleep' | 'mindful_session' | 'nutrition' | 'hydration' | 'menstrual_flow';

export type HealthImportRecord = {
  recordId: string;
  recordType: HealthRecordType;
  startAt: string;
  endAt?: string | null;
  recordedAt?: string | null;
  value: Record<string, unknown>;
  sourceName?: string | null;
  sourceId?: string | null;
};

/** Initial sport and recovery scope; the OS presents and manages read permissions. */
export const DEFAULT_HEALTH_TYPES: HealthRecordType[] = [
  'workout', 'step_count', 'distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance',
  'active_energy', 'exercise_time', 'heart_rate', 'resting_heart_rate', 'walking_heart_rate_average',
  'heart_rate_variability', 'oxygen_saturation', 'respiratory_rate', 'body_mass', 'body_fat_percentage',
  'lean_body_mass', 'vo2_max', 'sleep',
];

const iosQuantityTypes: Array<[string, HealthRecordType]> = [
  ['HKQuantityTypeIdentifierStepCount', 'step_count'],
  ['HKQuantityTypeIdentifierDistanceWalkingRunning', 'walking_running_distance'],
  ['HKQuantityTypeIdentifierDistanceCycling', 'cycling_distance'],
  ['HKQuantityTypeIdentifierDistanceSwimming', 'swimming_distance'],
  ['HKQuantityTypeIdentifierActiveEnergyBurned', 'active_energy'],
  ['HKQuantityTypeIdentifierBasalEnergyBurned', 'basal_energy'],
  ['HKQuantityTypeIdentifierAppleMoveTime', 'exercise_time'],
  ['HKQuantityTypeIdentifierFlightsClimbed', 'floors_climbed'],
  ['HKQuantityTypeIdentifierHeartRate', 'heart_rate'],
  ['HKQuantityTypeIdentifierRestingHeartRate', 'resting_heart_rate'],
  ['HKQuantityTypeIdentifierWalkingHeartRateAverage', 'walking_heart_rate_average'],
  ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'heart_rate_variability'],
  ['HKQuantityTypeIdentifierOxygenSaturation', 'oxygen_saturation'],
  ['HKQuantityTypeIdentifierRespiratoryRate', 'respiratory_rate'],
  ['HKQuantityTypeIdentifierBodyTemperature', 'body_temperature'],
  ['HKQuantityTypeIdentifierBloodPressureSystolic', 'blood_pressure'],
  ['HKQuantityTypeIdentifierBloodPressureDiastolic', 'blood_pressure'],
  ['HKQuantityTypeIdentifierBloodGlucose', 'blood_glucose'],
  ['HKQuantityTypeIdentifierBodyMass', 'body_mass'],
  ['HKQuantityTypeIdentifierBodyFatPercentage', 'body_fat_percentage'],
  ['HKQuantityTypeIdentifierLeanBodyMass', 'lean_body_mass'],
  ['HKQuantityTypeIdentifierHeight', 'height'],
  ['HKQuantityTypeIdentifierVO2Max', 'vo2_max'],
  ['HKQuantityTypeIdentifierDietaryEnergyConsumed', 'nutrition'],
  ...['DietaryProtein','DietaryCarbohydrates','DietaryFatTotal','DietaryFatSaturated','DietaryFatMonounsaturated','DietaryFatPolyunsaturated','DietaryFiber','DietaryWater','DietaryCaffeine','DietarySodium','DietarySugar','DietaryCholesterol','DietaryCalcium','DietaryIron','DietaryMagnesium','DietaryPotassium','DietaryVitaminA','DietaryVitaminB6','DietaryVitaminB12','DietaryVitaminC','DietaryVitaminD','DietaryVitaminE','DietaryVitaminK'].map((name) => [`HKQuantityTypeIdentifier${name}`, 'nutrition'] as [string, HealthRecordType]),
];
const iosCategoryTypes: Array<[string, HealthRecordType]> = [
  ['HKCategoryTypeIdentifierAppleStandHour', 'stand_time'],
  ['HKCategoryTypeIdentifierSleepAnalysis', 'sleep'],
  ['HKCategoryTypeIdentifierMindfulSession', 'mindful_session'],
  ['HKCategoryTypeIdentifierMenstrualFlow', 'menstrual_flow'],
];

const androidTypes: Array<[string, HealthRecordType]> = [
  ['ExerciseSession', 'workout'], ['Steps', 'step_count'], ['Distance', 'distance'],
  ['FloorsClimbed', 'floors_climbed'],
  ['ActiveCaloriesBurned', 'active_energy'], ['BasalMetabolicRate', 'basal_energy'], ['HeartRate', 'heart_rate'],
  ['RestingHeartRate', 'resting_heart_rate'], ['HeartRateVariabilityRmssd', 'heart_rate_variability'],
  ['OxygenSaturation', 'oxygen_saturation'], ['RespiratoryRate', 'respiratory_rate'],
  ['BodyTemperature', 'body_temperature'], ['BloodPressure', 'blood_pressure'], ['BloodGlucose', 'blood_glucose'],
  ['Weight', 'body_mass'], ['BodyFat', 'body_fat_percentage'], ['LeanBodyMass', 'lean_body_mass'], ['Height', 'height'],
  ['BodyWaterMass', 'body_water_mass'], ['BoneMass', 'bone_mass'], ['Hydration', 'hydration'],
  ['TotalCaloriesBurned', 'total_energy'], ['Vo2Max', 'vo2_max'], ['SleepSession', 'sleep'], ['Nutrition', 'nutrition'],
  ['MindfulnessSession', 'mindful_session'], ['MenstruationFlow', 'menstrual_flow'],
];

function idOf(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

async function readHealthKit(types: HealthRecordType[]): Promise<{ records: HealthImportRecord[]; supportedTypes: HealthRecordType[] }> {
  const hk = await import('@kingstinct/react-native-healthkit');
  if (!await hk.isHealthDataAvailable()) throw new Error('Apple Health ist auf diesem Gerät nicht verfügbar.');
  const quantityTypes = iosQuantityTypes.filter(([, type]) => types.includes(type));
  const categoryTypes = iosCategoryTypes.filter(([, type]) => types.includes(type));
  const supportedTypes = [...new Set([...quantityTypes.map(([, type]) => type), ...categoryTypes.map(([, type]) => type), ...(types.includes('workout') ? ['workout' as const] : [])])];
  const requested = [...new Set([...quantityTypes.map(([id]) => id), ...categoryTypes.map(([id]) => id), ...(types.includes('workout') ? ['HKWorkoutTypeIdentifier'] : [])])];
  await hk.requestAuthorization({ toRead: requested as never[] });
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const records: HealthImportRecord[] = [];
  for (const [identifier, recordType] of quantityTypes) {
    const samples = await hk.queryQuantitySamples(identifier as never, { limit: 0, ascending: false, filter: { date: { startDate: since } } });
    for (const sample of samples) records.push({
      recordId: sample.uuid,
      recordType,
      startAt: sample.startDate.toISOString(),
      endAt: sample.endDate.toISOString(),
      value: { quantity: sample.quantity, unit: sample.unit, identifier, metadata: sample.metadata },
      sourceName: sample.sourceRevision?.source?.name ?? null,
      sourceId: sample.sourceRevision?.source?.bundleIdentifier ?? null,
    });
  }
  for (const [identifier, recordType] of categoryTypes) {
    const samples = await hk.queryCategorySamples(identifier as never, { limit: 0, ascending: false, filter: { date: { startDate: since } } });
    for (const sample of samples) records.push({ recordId: sample.uuid, recordType, startAt: sample.startDate.toISOString(), endAt: sample.endDate.toISOString(), value: { value: sample.value, identifier, metadata: sample.metadata }, sourceName: sample.sourceRevision?.source?.name ?? null, sourceId: sample.sourceRevision?.source?.bundleIdentifier ?? null });
  }
  if (types.includes('workout')) {
    const workouts = await hk.queryWorkoutSamples({ limit: 0, ascending: false, filter: { date: { startDate: since } } });
    for (const workout of workouts) {
      const item = workout.toJSON();
      records.push({ recordId: item.uuid, recordType: 'workout', startAt: item.startDate.toISOString(), endAt: item.endDate.toISOString(), value: { activityType: item.workoutActivityType, duration: item.duration, totalEnergyBurned: item.totalEnergyBurned, totalDistance: item.totalDistance, events: item.events, activities: item.activities }, sourceName: item.sourceRevision?.source?.name ?? null, sourceId: item.sourceRevision?.source?.bundleIdentifier ?? null });
      workout.dispose();
    }
  }
  return { records, supportedTypes };
}

async function readHealthConnect(types: HealthRecordType[]): Promise<{ records: HealthImportRecord[]; supportedTypes: HealthRecordType[] }> {
  const hc = await import('react-native-health-connect');
  const available = await hc.initialize();
  if (!available) throw new Error('Health Connect ist auf diesem Gerät nicht verfügbar.');
  const mappings = androidTypes.filter(([, canonical]) => types.includes(canonical));
  const permissions = mappings.map(([recordType]) => ({ accessType: 'read' as const, recordType: recordType as never }));
  const granted = await hc.requestPermission(permissions);
  const grantedTypes = new Set(granted.filter((permission) => permission.accessType === 'read').map((permission) => permission.recordType));
  const grantedMappings = mappings.filter(([recordType]) => grantedTypes.has(recordType as never));
  if (!grantedMappings.length) throw new Error('Health Connect hat keinen der ausgewählten Datentypen freigegeben.');
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endTime = new Date().toISOString();
  const records: HealthImportRecord[] = [];
  for (const [nativeType, recordType] of grantedMappings) {
    let pageToken: string | undefined;
    do {
      const result = await hc.readRecords(nativeType as never, { timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime }, pageSize: 500, ...(pageToken ? { pageToken } : {}) });
      for (const item of result.records as unknown as Array<Record<string, unknown>>) {
        const metadata = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<string, unknown>;
        const startAt = typeof item.startTime === 'string' ? item.startTime : typeof item.time === 'string' ? item.time : null;
        if (!startAt) continue;
        const endAt = typeof item.endTime === 'string' ? item.endTime : null;
        const { metadata: _metadata, exerciseRoute: _route, ...value } = item;
        records.push({
          recordId: idOf(metadata.id, `${nativeType}:${startAt}:${JSON.stringify(value).slice(0, 80)}`),
          recordType,
          startAt,
          endAt,
          value: value as Record<string, unknown>,
          sourceName: typeof metadata.dataOrigin === 'string' ? metadata.dataOrigin : null,
          sourceId: typeof metadata.dataOrigin === 'string' ? metadata.dataOrigin : null,
          recordedAt: typeof metadata.lastModifiedTime === 'string' ? metadata.lastModifiedTime : null,
        });
      }
      pageToken = result.pageToken;
    } while (pageToken);
  }
  return { records, supportedTypes: [...new Set(grantedMappings.map(([, type]) => type))] };
}

export async function readDeviceHealthData(types: HealthRecordType[]) {
  if (Platform.OS === 'ios') return { provider: 'APPLE_HEALTH' as const, ...await readHealthKit(types) };
  if (Platform.OS === 'android') return { provider: 'HEALTH_CONNECT' as const, ...await readHealthConnect(types) };
  throw new Error('Gesundheitsdaten werden nur in den nativen iOS- und Android-Apps unterstützt.');
}

export async function importHealthData(apiFetch: (path: string, init?: RequestInit) => Promise<Response>, types: HealthRecordType[]) {
  const { provider, records, supportedTypes } = await readDeviceHealthData(types);
  if (!supportedTypes.length) throw new Error('Die ausgewählten Datentypen werden auf diesem Gerät nicht unterstützt.');
  const consent = await apiFetch('/api/mobile/health/consent', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, accepted: true, types: supportedTypes }),
  });
  if (!consent.ok) throw new Error('Die Zustimmung konnte nicht gespeichert werden.');
  let saved = 0;
  const batches = records.length ? Array.from({ length: Math.ceil(records.length / 400) }, (_, index) => records.slice(index * 400, (index + 1) * 400)) : [[]];
  for (const batch of batches) {
    const response = await apiFetch('/api/mobile/health/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, records: batch }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error ?? 'Die Gesundheitsdaten konnten nicht gespeichert werden.');
    }
    const payload = await response.json() as { saved?: number };
    saved += payload.saved ?? 0;
  }
  return { provider, saved };
}
