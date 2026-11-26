import { db } from '@/lib/db';
import { buildCanonicalActivities } from '@/lib/mobile/health-overview';

const HEALTH_ACTIVITY_PREFIX = 'health:';
const SIGNAL_TYPES = ['workout', 'distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance', 'resting_heart_rate', 'body_mass'];

/**
 * One activity list per session for training decisions. Health workouts are the primary
 * source: they enrich the matching Strava activity (distance, duration, heart rate) and
 * Health-only workouts count as well. Materialized Health rows in the activity table are
 * skipped here because they are rebuilt from the records themselves.
 */
export async function loadCanonicalActivities(userId: string, from: Date, to: Date) {
  const [stravaActivities, signals, heartRates] = await Promise.all([
    db.activity.findMany({ where: { userId, startDate: { gte: from, lte: to }, NOT: { stravaId: { startsWith: HEALTH_ACTIVITY_PREFIX } } } }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: from, lte: to }, recordType: { in: SIGNAL_TYPES } },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 2500,
    }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: from, lte: to }, recordType: 'heart_rate' },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 5000,
    }),
  ]);
  const healthRecords = [...signals, ...heartRates];
  return { activities: buildCanonicalActivities(userId, healthRecords, stravaActivities, to), healthRecords };
}
