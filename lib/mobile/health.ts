export const HEALTH_PROVIDERS = ['APPLE_HEALTH', 'HEALTH_CONNECT'] as const;
export type HealthProvider = (typeof HEALTH_PROVIDERS)[number];

// Canonical cross-platform types. Clinical records and identifiers are intentionally excluded.
export const HEALTH_RECORD_TYPES = [
  'workout', 'step_count', 'distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance', 'floors_climbed',
  'active_energy', 'basal_energy', 'total_energy', 'exercise_time', 'stand_time', 'heart_rate',
  'resting_heart_rate', 'walking_heart_rate_average', 'heart_rate_variability', 'oxygen_saturation',
  'respiratory_rate', 'body_temperature', 'blood_pressure', 'body_mass', 'body_fat_percentage',
  'lean_body_mass', 'height', 'body_water_mass', 'bone_mass', 'vo2_max', 'blood_glucose',
  'sleep', 'mindful_session', 'nutrition', 'hydration', 'menstrual_flow',
] as const;
export type HealthRecordType = (typeof HEALTH_RECORD_TYPES)[number];

export function isHealthProvider(value: unknown): value is HealthProvider {
  return typeof value === 'string' && HEALTH_PROVIDERS.includes(value as HealthProvider);
}

export function isHealthRecordType(value: unknown): value is HealthRecordType {
  return typeof value === 'string' && HEALTH_RECORD_TYPES.includes(value as HealthRecordType);
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const latest = Date.now() + 24 * 60 * 60 * 1000;
  if (date.getTime() < Date.UTC(1900, 0, 1) || date.getTime() > latest) return null;
  return date;
}

export function isSafeJson(value: unknown, maxBytes = 20_000): value is Record<string, unknown> {
  if (!isJsonObject(value)) return false;
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes;
  } catch {
    return false;
  }
}
