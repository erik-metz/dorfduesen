import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { berlinMidnight, dayKey, shiftDay } from '@/lib/time';
import { Prisma as Sql } from '@prisma/client';
import { calculateFitnessHistory } from '@/lib/training/history';
import { isHealthRecordType } from '@/lib/mobile/health';
import type { ActivityDetailData } from '@/lib/strava/activity-detail';

export const planSelect = {
  id: true, title: true, status: true, goalType: true, targetDate: true,
  currentWeek: true, totalWeeks: true, targetDistance: true, targetTimeSeconds: true,
} satisfies Prisma.TrainingPlanSelect;

export const weekSelect = {
  weekNumber: true, phase: true, targetDistance: true, actualDistance: true, focusTitle: true,
  workouts: {
    orderBy: { scheduledDate: 'asc' },
    select: {
      scheduledDate: true, title: true, description: true, sportType: true, status: true,
      targetDistance: true, targetDurationMinutes: true, targetPaceMin: true, targetPaceMax: true,
      targetHrZone: true, matchedActivityId: true,
    },
  },
} satisfies Prisma.PlanWeekSelect;

const activitySelect = {
  id: true, stravaId: true, name: true, sportType: true, startDate: true, distance: true,
  manualDistance: true, extractedDistance: true, movingTime: true, totalElevationGain: true,
  averageHeartrate: true, maxHeartrate: true, averageSpeed: true,
} satisfies Prisma.ActivitySelect;

type Activity = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;
function activitySummary(activity: Activity, healthHeartRate: boolean) {
  const { id, stravaId, name, manualDistance, extractedDistance, distance, ...data } = activity;
  const strava = !stravaId.startsWith('health:');
  return {
    ...data,
    id,
    name: name.slice(0, 160),
    ...(!strava && !healthHeartRate ? { averageHeartrate: null, maxHeartrate: null } : {}),
    distanceMeters: manualDistance ?? extractedDistance ?? distance,
    source: strava ? 'Strava' : 'Health-Import',
    reference: /^\d+$/.test(stravaId) ? `https://www.strava.com/activities/${stravaId}` : undefined,
  };
}

function dateKey(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export async function readCoachData(userId: string, input: Record<string, unknown>) {
  const { dataset, id, sport, recordType } = input;
  const today = dayKey();
  const from = dateKey(input.from) ?? shiftDay(today, -55);
  const to = dateKey(input.to) ?? today;
  const start = berlinMidnight(from);
  const end = berlinMidnight(shiftDay(to, 1));
  const period = { gte: start, lt: end };
  if (end <= start || end.getTime() - start.getTime() > 367 * 86400000) {
    return { data: { error: 'Bitte einen Zeitraum von höchstens einem Jahr je Abfrage wählen.' } };
  }

  const healthConnections = ['weekly_training', 'activities', 'activity', 'health'].includes(String(dataset))
    ? await db.mobileHealthConnection.findMany({
      where: { userId, revokedAt: null, consentedAt: { not: null } },
      select: { provider: true, consentedTypes: true },
    })
    : [];
  const healthPrefixes = healthConnections.filter(connection => connection.consentedTypes.includes('workout'))
    .map(connection => `health:${userId}:${connection.provider}:`);
  const activitySource = {
    OR: [{ NOT: { stravaId: { startsWith: 'health:' } } }, ...healthPrefixes.map(prefix => ({ stravaId: { startsWith: prefix } }))],
  };
  const healthHeartRate = (stravaId: string) => healthConnections.some(connection =>
    stravaId.startsWith(`health:${userId}:${connection.provider}:`) && connection.consentedTypes.includes('heart_rate'));

  switch (dataset) {
    case 'profile': {
      const [profile, goals] = await Promise.all([
        db.userProfile.findUnique({
          where: { userId },
          select: {
            heightCm: true, weightKg: true, restingHeartrate: true, maxHeartrate: true,
            estimatedVo2max: true, vdotScore: true, weeklyAvailability: true, preferredLongRunDay: true,
            includeSundayRun: true, preferredTerrain: true, notes: true,
          },
        }),
        db.weeklyGoal.findMany({
          where: { userId, weekKey: { gte: from, lte: to } },
          select: { weekKey: true, activeDays: true }, orderBy: { weekKey: 'desc' },
        }),
      ]);
      return { data: { profile, goals, from, to, source: 'Coach-Profil und Wochenziele' } };
    }
    case 'fitness': {
      const asOf = new Date(Math.min(Date.now(), end.getTime() - 1));
      const [runs, metrics] = await Promise.all([
        db.activity.findMany({
          where: { userId, sportType: 'Run', NOT: { stravaId: { startsWith: 'health:' } },
            startDate: { gte: new Date(asOf.getTime() - 280 * 86400000), lte: asOf } },
          orderBy: { startDate: 'desc' }, take: 501,
          select: {
            stravaId: true, startDate: true, sportType: true, distance: true, movingTime: true, elapsedTime: true,
            totalElevationGain: true, averageHeartrate: true, maxHeartrate: true,
          },
        }),
        db.healthMetric.findMany({
          where: { userId, date: { lte: asOf } },
          select: { date: true, weightKg: true, restingHeartrate: true }, orderBy: { date: 'desc' }, take: 101,
        }),
      ]);
      const history = calculateFitnessHistory(userId, runs.slice(0, 500), metrics.slice(0, 100), asOf)
        .filter(point => new Date(point.date) >= start)
        .map(({ date, vo2max, vdot, maxHr, maxHrSource, restingHeartrate, weightKg }) => ({
          date, vo2max, vdot, maxHr, maxHrSource, restingHeartrate, weightKg,
        }));
      return { data: { history, source: 'Rekonstruierte Coach-Schätzwerte aus Strava-Läufen und manuellen Coach-Messwerten', truncated: runs.length > 500 || metrics.length > 100 } };
    }
    case 'arena': {
      const [badges, weekly, monthly] = await Promise.all([
        db.userBadge.findMany({
          where: { userId, unlockedAt: period },
          select: { badge: { select: { name: true, category: true } }, level: true, unlockedAt: true },
          orderBy: { unlockedAt: 'desc' }, take: 60,
        }),
        db.weeklyTitleHolder.findMany({
          where: { userId, weekKey: { gte: from, lte: to } },
          select: { weekKey: true, titleId: true, isFinalized: true }, orderBy: { weekKey: 'desc' }, take: 60,
        }),
        db.monthlyTitleHolder.findMany({
          where: { userId, monthKey: { gte: from.slice(0, 7), lte: to.slice(0, 7) } },
          select: { monthKey: true, titleId: true, isFinalized: true }, orderBy: { monthKey: 'desc' }, take: 60,
        }),
      ]);
      return { data: { badges, weekly, monthly, from, to, source: 'DorfDüsen-Arena', truncated: [badges, weekly, monthly].some(items => items.length === 60) } };
    }
    case 'weekly_training': {
      const sportFilter = typeof sport === 'string' ? sport.slice(0, 40) : null;
      const weeks = await db.$queryRaw<Array<{ week: string; sport: string; sessions: number; meters: number; seconds: number }>>`
        SELECT to_char(date_trunc('week', "startDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') AS week,
          "sportType" AS sport, count(*)::int AS sessions,
          sum(coalesce("manualDistance", "extractedDistance", distance)) AS meters,
          sum("movingTime")::double precision AS seconds
        FROM "Activity"
        WHERE "userId" = ${userId} AND "startDate" >= ${start} AND "startDate" < ${end}
          AND ("stravaId" NOT LIKE 'health:%' ${healthPrefixes.length
            ? Sql.sql`OR ${Sql.join(healthPrefixes.map(prefix => Sql.sql`starts_with("stravaId", ${prefix})`), ' OR ')}`
            : Sql.empty})
          AND (${sportFilter}::text IS NULL OR "sportType" = ${sportFilter})
        GROUP BY 1, 2 ORDER BY 1, 2 LIMIT 300`;
      return { data: { from, to, weeks, truncated: weeks.length === 300, source: 'Synchronisierte Strava- und Health-Aktivitäten' } };
    }
    case 'activities': {
      const items = await db.activity.findMany({
        where: { userId, ...activitySource, startDate: period, ...(typeof sport === 'string' ? { sportType: sport.slice(0, 40) } : {}) },
        select: activitySelect, orderBy: { startDate: 'desc' }, take: 21,
      });
      const activities = items.slice(0, 20).map(item => activitySummary(item, healthHeartRate(item.stravaId)));
      return {
        data: { from, to, activities, truncated: items.length > 20 },
        sources: activities.flatMap(item => item.reference ? [{ label: item.name, url: item.reference }] : []),
      };
    }
    case 'activity': {
      if (typeof id !== 'string' || id.length > 240) return { data: null };
      const item = await db.activity.findFirst({ where: { userId, ...activitySource, AND: [{ OR: [{ id }, { stravaId: id }] }] }, select: { ...activitySelect, detailJson: true } });
      if (!item) return { data: null };
      const { detailJson, ...activity } = item;
      const summary = activitySummary(activity, healthHeartRate(activity.stravaId));
      const detail = detailJson as unknown as ActivityDetailData | null;
      const splits = detail?.splitsMetric;
      return {
        data: { ...summary, splits: splits?.slice(0, 60) ?? null, splitsTruncated: (splits?.length ?? 0) > 60 },
        sources: summary.reference ? [{ label: summary.name, url: summary.reference }] : [],
      };
    }
    case 'health': {
      const type = typeof recordType === 'string' && isHealthRecordType(recordType) ? recordType : undefined;
      const [records, manual] = await Promise.all([
        db.mobileHealthRecord.findMany({
          where: {
            userId, startAt: period, recordType: type,
            OR: healthConnections.map(({ provider, consentedTypes }) => ({ provider, recordType: { in: consentedTypes } })),
          },
          select: { provider: true, recordType: true, startAt: true, endAt: true, value: true },
          orderBy: { startAt: 'desc' }, take: 41,
        }),
        db.healthMetric.findMany({
          where: { userId, date: period }, select: { date: true, weightKg: true, restingHeartrate: true },
          orderBy: { date: 'desc' }, take: 41,
        }),
      ]);
      return { data: { from, to, recordType: type, records: records.slice(0, 40), manual: manual.slice(0, 40),
        truncated: records.length > 40 || manual.length > 40, source: 'Apple Health, Health Connect und manuelle Coach-Messwerte' } };
    }
    case 'plans': {
      const plans = await db.trainingPlan.findMany({
        where: { userId, OR: [{ status: 'ACTIVE' }, { startDate: { lt: end }, endDate: { gte: start } }] },
        select: planSelect, orderBy: { createdAt: 'desc' }, take: 12,
      });
      return { data: { plans, from, to, source: 'DorfDüsen-Trainingspläne' } };
    }
    case 'plan_week': {
      if (typeof id !== 'string' || !Number.isInteger(input.week)) return { data: null };
      const week = await db.planWeek.findFirst({ where: { plan: { id, userId }, weekNumber: Number(input.week) }, select: weekSelect });
      return { data: { week, source: 'DorfDüsen-Trainingsplan' } };
    }
    default: return { data: { error: 'Unbekannter Datensatz.' } };
  }
}
