import { db } from '@/lib/db';
import { getValidStravaToken } from './tokens';
import { inngest } from '@/lib/inngest/client';

export interface StravaRawActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type?: string;
  start_date: string;
  start_date_local: string;
  timezone?: string;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kudos_count?: number;
  comment_count?: number;
  achievement_count?: number;
  map?: {
    summary_polyline?: string;
  };
}


export interface SyncPageOptions { page: number; after?: number; before?: number; historical?: boolean }
export interface SyncResult { success: boolean; count: number; hasMore?: boolean; error?: string; retryAt?: string }

/** One bounded page per durable job step. A shared lease protects every caller. */
export async function syncUserActivities(userId: string, perPage = 100, options: SyncPageOptions = { page: 1 }): Promise<SyncResult> {
  const owner = crypto.randomUUID();
  const now = new Date();
  await db.syncState.upsert({ where: { userId }, create: { userId }, update: {} });
  const lease = await db.syncState.updateMany({
    where: { userId, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { lockOwner: owner, lockedUntil: new Date(now.getTime() + 5 * 60000) },
  });
  if (lease.count === 0) return { success: false, count: 0, error: 'Sync already running', retryAt: new Date(Date.now() + 30000).toISOString() };
  try {
    const accessToken = await getValidStravaToken(userId);
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    url.searchParams.set('page', String(options.page));
    url.searchParams.set('per_page', String(perPage));
    if (options.after !== undefined) url.searchParams.set('after', String(options.after));
    if (options.before !== undefined) url.searchParams.set('before', String(options.before));
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) {
      const raw = response.headers.get('retry-after');
      const parsed = raw && /^\d+$/.test(raw) ? Date.now() + Number(raw) * 1000 : raw ? Date.parse(raw) : NaN;
      const fallback = Math.ceil(Date.now() / 900000) * 900000 + 10000;
      return { success: false, count: 0, error: 'Strava rate limit', retryAt: new Date(Number.isFinite(parsed) ? Math.max(parsed, Date.now() + 1000) : fallback).toISOString() };
    }
    if (!response.ok) throw new Error(`Strava API Fehler: ${response.status}`);
    const activities: StravaRawActivity[] = await response.json();
    if (!Array.isArray(activities)) throw new Error('Invalid Strava response');
    const activePlan = await db.trainingPlan.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true, startDate: true } });
    const events = [];
    let syncedCount = 0;
    for (const act of activities) {
      const stravaId = String(act.id);
      const sportType = act.sport_type || act.type || 'Workout';
      const record = await db.activity.upsert({
        where: { stravaId },
        update: {
          name: act.name,
          distance: act.distance,
          movingTime: act.moving_time,
          elapsedTime: act.elapsed_time,
          totalElevationGain: act.total_elevation_gain,
          sportType: sportType,
          startDate: new Date(act.start_date),
          startDateLocal: new Date(act.start_date_local),
          timezone: act.timezone || null,
          averageSpeed: act.average_speed ?? null,
          maxSpeed: act.max_speed ?? null,
          averageHeartrate: act.average_heartrate ?? null,
          maxHeartrate: act.max_heartrate ?? null,
          kudosCount: act.kudos_count ?? 0,
          commentCount: act.comment_count ?? 0,
          achievementCount: act.achievement_count ?? 0,
          summaryPolyline: act.map?.summary_polyline ?? null,
          syncedAt: new Date(),
        },
        create: {
          userId,
          stravaId,
          name: act.name,
          distance: act.distance,
          movingTime: act.moving_time,
          elapsedTime: act.elapsed_time,
          totalElevationGain: act.total_elevation_gain,
          sportType: sportType,
          startDate: new Date(act.start_date),
          startDateLocal: new Date(act.start_date_local),
          timezone: act.timezone || null,
          averageSpeed: act.average_speed ?? null,
          maxSpeed: act.max_speed ?? null,
          averageHeartrate: act.average_heartrate ?? null,
          maxHeartrate: act.max_heartrate ?? null,
          kudosCount: act.kudos_count ?? 0,
          commentCount: act.comment_count ?? 0,
          achievementCount: act.achievement_count ?? 0,
          summaryPolyline: act.map?.summary_polyline ?? null,
        },
      });


      if (activePlan && new Date(act.start_date) >= activePlan.startDate && sportType.toLowerCase().includes('run')) {
        events.push({ id: `activity:${record.id}:plan:${activePlan.id}`, name: 'strava/activity.synced',
          data: { activityId: record.id, userId, planId: activePlan.id } });
      }
      syncedCount++;
    }
    if (events.length) await inngest.send(events);
    const hasMore = activities.length === perPage;
    await db.syncState.updateMany({ where: { userId, lockOwner: owner }, data: options.historical
      ? { historicalPage: options.page + 1, ...(!hasMore ? { historyCompletedAt: new Date() } : {}) }
      : !hasMore ? { lastSyncedAt: new Date((options.before ?? Math.floor(Date.now() / 1000)) * 1000) } : {} });
    await db.syncLog.create({ data: { userId, status: 'SUCCESS', itemsSynced: syncedCount } });
    return { success: true, count: syncedCount, hasMore };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Synchronisationsfehler';
    await db.syncLog.create({ data: { userId, status: 'ERROR', errorMessage: errorMsg } });
    return { success: false, count: 0, error: errorMsg };
  } finally {
    await db.syncState.updateMany({ where: { userId, lockOwner: owner }, data: { lockOwner: null, lockedUntil: null } });
  }
}

export async function finalizeSync(userId: string) {
  const { revalidatePath, revalidateTag } = await import('next/cache');
  revalidatePath('/arena'); revalidatePath('/'); revalidateTag('arena', { expire: 0 });
  const { checkWeeklyTitleChanges } = await import('@/lib/arena/title-tracker');
  await checkWeeklyTitleChanges();
  const { evaluateUserBadges } = await import('@/lib/arena/badge-engine');
  await evaluateUserBadges(userId);
}
