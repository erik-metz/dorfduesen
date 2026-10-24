import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { buildHealthOnlyCanonicalActivities } from './health-overview';

const HEALTH_ACTIVITY_PREFIX = 'health:';
const MATCHING_RECORD_TYPES = [
  'workout',
  'distance',
  'walking_running_distance',
  'cycling_distance',
  'swimming_distance',
  'heart_rate',
] as const;

/**
 * Materialize Health-only sessions as Activity rows so every existing activity
 * consumer (dashboard, website, Arena, weekly champions and badges) sees them.
 * Strava remains the primary activity when its workout matches a Health workout.
 */
export async function reconcileHealthActivities(userId: string) {
  const prefix = `${HEALTH_ACTIVITY_PREFIX}${userId}:`;
  const [records, stravaActivities, existingHealthActivities] = await Promise.all([
    db.mobileHealthRecord.findMany({
      where: { userId, recordType: { in: [...MATCHING_RECORD_TYPES] } },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'asc' },
    }),
    db.activity.findMany({
      where: { userId, NOT: { stravaId: { startsWith: HEALTH_ACTIVITY_PREFIX } } },
      select: { id: true, stravaId: true, name: true, sportType: true, startDate: true, elapsedTime: true, distance: true },
    }),
    db.activity.findMany({ where: { userId, stravaId: { startsWith: prefix } }, select: { stravaId: true } }),
  ]);

  const healthActivities = buildHealthOnlyCanonicalActivities(userId, records, stravaActivities, new Date());
  const recordByActivityId = new Map(records.map(record => [`health:${record.id}`, record]));
  const desiredIds = new Set(healthActivities.map(activity => activity.stravaId));
  const staleIds = existingHealthActivities.map(activity => activity.stravaId).filter(id => !desiredIds.has(id));

  await db.$transaction(async tx => {
    for (const activity of healthActivities) {
      const { id, stravaId, userId: ownerId, ...fields } = activity;
      const record = recordByActivityId.get(id);
      const value = record?.value && typeof record.value === 'object' && !Array.isArray(record.value)
        ? record.value as Record<string, unknown>
        : {};
      const energy = value.totalEnergyBurned && typeof value.totalEnergyBurned === 'object'
        ? value.totalEnergyBurned as Record<string, unknown>
        : {};
      const energyQuantity = typeof energy.quantity === 'number' ? energy.quantity : null;
      const healthDetail: Prisma.InputJsonObject = {
        id,
        stravaId,
        name: activity.name,
        description: `Importiert aus ${record?.provider === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect'}`,
        sportType: activity.sportType,
        startDate: activity.startDate.toISOString(),
        distance: activity.distance,
        movingTime: activity.movingTime,
        elapsedTime: activity.elapsedTime,
        totalElevationGain: activity.totalElevationGain,
        calories: energyQuantity,
        averageHeartrate: activity.averageHeartrate,
        maxHeartrate: activity.maxHeartrate,
        averageSpeed: activity.averageSpeed,
        maxSpeed: activity.maxSpeed,
        deviceName: record?.sourceName ?? null,
        sourceName: record?.provider === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect',
        summaryPolyline: null,
        detailedPolyline: null,
        streams: [],
        splitsMetric: [],
        bestEfforts: [],
        segmentEfforts: [],
        cachedAt: new Date().toISOString(),
      };
      const data = { ...fields, detailJson: healthDetail };
      await tx.activity.upsert({
        where: { stravaId },
        create: { id, stravaId, userId: ownerId, ...data },
        update: data,
      });
    }
    if (staleIds.length) {
      await tx.activity.deleteMany({ where: { userId, stravaId: { in: staleIds } } });
    }
  });

  return { createdOrUpdated: healthActivities.length, removed: staleIds.length };
}
