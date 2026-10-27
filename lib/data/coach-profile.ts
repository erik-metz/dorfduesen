import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';
import { baselineFromActivities } from '@/lib/training/baseline-calculation';
import { calculateFitnessHistory } from '@/lib/training/history';
import { estimateVo2max } from '@/lib/training/vo2max';
import { getTrainingPaces } from '@/lib/training/vdot';
import { calculateHeartRateZones, estimateMaxHeartRate } from '@/lib/training/zones';
import { buildCanonicalActivities, buildHealthOverview, healthMetricHistory } from '@/lib/mobile/health-overview';

export async function getCoachProfileData(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 20, revalidate: 30, expire: 120 });
  cacheTag(cacheTags.userProfile(userId), cacheTags.userHealth(userId), cacheTags.userActivities(userId));

  const now = new Date();
  const healthFrom = new Date(now.getTime() - 182 * 86400000);
  const [profile, activities, metrics, healthWorkouts, healthSignals, healthDailyRecords, healthHeartRate] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.activity.findMany({ where: { userId, startDate: { gte: new Date(now.getTime() - 38 * 7 * 86400000), lte: now } } }),
    db.healthMetric.findMany({ where: { userId, date: { lte: now } }, orderBy: { date: 'desc' } }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: healthFrom, lte: now }, recordType: { in: ['workout', 'distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance'] } },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 2500,
    }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: healthFrom, lte: now }, recordType: { in: ['vo2_max', 'resting_heart_rate', 'heart_rate_variability', 'body_mass', 'body_fat_percentage', 'oxygen_saturation', 'respiratory_rate'] } },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 1500,
    }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: healthFrom, lte: now }, recordType: { in: ['sleep', 'step_count'] } },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 4000,
    }),
    db.mobileHealthRecord.findMany({
      where: { userId, startAt: { gte: new Date(now.getTime() - 84 * 86400000), lte: now }, recordType: 'heart_rate' },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 5000,
    }),
  ]);
  const healthRecords = [...healthWorkouts, ...healthSignals, ...healthDailyRecords, ...healthHeartRate];
  const canonicalActivities = buildCanonicalActivities(userId, healthRecords, activities, now);
  const healthMetrics = healthMetricHistory(healthRecords, userId);
  const historicalMetrics = [...metrics, ...healthMetrics].sort((a, b) => b.date.getTime() - a.date.getTime());
  const latestHealthRestingHr = healthMetrics.filter(metric => metric.restingHeartrate !== null).sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.restingHeartrate ?? null;
  const calculationProfile = { maxHeartrate: profile?.maxHeartrate ?? null, restingHeartrate: profile?.restingHeartrate ?? latestHealthRestingHr };
  const baseline = baselineFromActivities(userId, canonicalActivities, calculationProfile, now);
  const history = calculateFitnessHistory(userId, canonicalActivities, historicalMetrics, now);

  const effectiveMaxHr = profile?.maxHeartrate || baseline.measuredMaxHr || estimateMaxHeartRate(30);
  const birthDate = profile?.birthDate;
  const age = birthDate ? now.getUTCFullYear() - birthDate.getUTCFullYear() - (now.getUTCMonth() < birthDate.getUTCMonth() || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate()) ? 1 : 0) : null;
  const validAge = age !== null && age >= 18 && age <= 100;
  const vo2maxHr = profile?.maxHeartrate ?? (validAge ? estimateMaxHeartRate(age) : baseline.measuredMaxHr ?? 185);
  const vo2maxSource = profile?.maxHeartrate ? 'profile' : validAge ? 'age' : baseline.measuredMaxHr ? 'recorded' : 'default';
  const vo2max = estimateVo2max(canonicalActivities, now, vo2maxHr, vo2maxSource, calculationProfile.restingHeartrate);
  const effectiveVdot = profile?.vdotScore ?? baseline.estimatedVdot;

  return {
    profile,
    history,
    vo2max,
    baseline,
    paces: getTrainingPaces(effectiveVdot),
    zones: calculateHeartRateZones(effectiveMaxHr, calculationProfile.restingHeartrate ?? undefined),
    calculatedVdot: effectiveVdot,
    calculatedMaxHr: effectiveMaxHr,
    calculatedRestingHeartrate: calculationProfile.restingHeartrate,
    healthOverview: buildHealthOverview(healthRecords, activities, now),
  };
}

export async function getCoachMetrics(userId: string, take = 90) {
  'use cache: remote';
  cacheLife({ stale: 15, revalidate: 30, expire: 120 });
  cacheTag(cacheTags.userHealth(userId), cacheTags.userProfile(userId));
  return db.healthMetric.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: Math.min(90, Math.max(1, take)) });
}
