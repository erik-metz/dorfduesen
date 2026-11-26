import { db } from "@/lib/db";
import { COACH_RECOVERY_TYPES, healthMetricHistory, needsGentlerTrainingStart } from "@/lib/mobile/health-overview";
import { loadCanonicalActivities } from "./canonical-activities";
import { baselineFromActivities } from "./baseline-calculation";
export type { AthleteBaseline } from "./baseline-calculation";

export async function calculateAthleteBaseline(userId: string) {
  const now = new Date();
  const healthFrom = new Date(now.getTime() - 84 * 86400000);
  const [{ activities: canonicalActivities, healthRecords }, profile, recoveryRecords] = await Promise.all([
    loadCanonicalActivities(userId, healthFrom, now),
    db.userProfile.findUnique({ where: { userId } }),
    db.mobileHealthRecord.findMany({
      where: {
        userId, startAt: { gte: new Date(now.getTime() - 24 * 86400000), lte: now },
        recordType: { in: [...COACH_RECOVERY_TYPES] },
      },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' }, take: 1500,
    }),
  ]);
  const healthMetrics = healthMetricHistory(healthRecords, userId);
  const restingHeartrate = profile?.restingHeartrate ?? healthMetrics
    .filter(metric => metric.restingHeartrate !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.restingHeartrate ?? null;
  const calculationProfile = { maxHeartrate: profile?.maxHeartrate ?? null, restingHeartrate };
  const connections = recoveryRecords.length ? await db.mobileHealthConnection.findMany({
    where: { userId, revokedAt: null, consentedAt: { not: null } },
    select: { provider: true, consentedTypes: true },
  }) : [];
  const recoverySamples = recoveryRecords.filter(record => connections.some(
    connection => connection.provider === record.provider && connection.consentedTypes.includes(record.recordType),
  ));
  return {
    stats: baselineFromActivities(userId, canonicalActivities, calculationProfile, now),
    gentlerStart: needsGentlerTrainingStart(recoverySamples, now),
  };
}
