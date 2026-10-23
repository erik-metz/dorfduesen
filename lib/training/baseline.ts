import { db } from "@/lib/db";
import { buildCanonicalActivities, healthMetricHistory } from "@/lib/mobile/health-overview";
import { baselineFromActivities } from "./baseline-calculation";
export type { AthleteBaseline } from "./baseline-calculation";

export async function calculateAthleteBaseline(userId: string) {
  const now = new Date();
  const healthFrom = new Date(now.getTime() - 84 * 86400000);
  const [activities, profile, workoutsAndVitals, heartRateRecords] = await Promise.all([
    db.activity.findMany({ where: { userId, startDate: { gte: new Date(now.getTime() - 84 * 86400000), lte: now } } }),
    db.userProfile.findUnique({ where: { userId } }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: healthFrom, lte: now }, recordType: { in: ['workout', 'distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance', 'resting_heart_rate', 'body_mass'] } },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 2500,
    }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: healthFrom, lte: now }, recordType: 'heart_rate' },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 5000,
    }),
  ]);
  const healthRecords = [...workoutsAndVitals, ...heartRateRecords];
  const healthMetrics = healthMetricHistory(healthRecords, userId);
  const restingHeartrate = profile?.restingHeartrate ?? healthMetrics
    .filter(metric => metric.restingHeartrate !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.restingHeartrate ?? null;
  const calculationProfile = { maxHeartrate: profile?.maxHeartrate ?? null, restingHeartrate };
  const canonicalActivities = buildCanonicalActivities(userId, healthRecords, activities, now);
  return baselineFromActivities(userId, canonicalActivities, calculationProfile, now);
}
