import { isTerritoryBudgetError, TERRITORY_REPLAY_BUDGET_MS, TERRITORY_RETRY_SECONDS, TerritoryBudgetExceededError } from './budget';
import type { TerritoryData } from './types';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getValidStravaToken } from '@/lib/strava/tokens';
import { RetryAfterError } from 'inngest';
import { evaluateLoop, reasons, replayClaims, RULES_VERSION, seasonRange, type Reason, type Shape } from './engine';

// In-process promise deduplication is only an optimization. The shared projection lives in Postgres.
type TerritoryProjection = ReturnType<typeof replayClaims>;
type ProjectionCache = { key: string; value: Promise<TerritoryProjection> };
let projectionCache: ProjectionCache | null = null;

function projectionFromJson(value: Prisma.JsonValue): TerritoryProjection {
  return value as unknown as TerritoryProjection;
}

async function getProjection(seasonKey: string, inputHash: string, valid: Array<{ id: string; activityId: string; sourceHash: string; checkedAt: Date; endedAt: Date; activity: { userId: string } }>) {
  const cached = await db.territoryProjectionCache.findUnique({ where: { seasonKey } });
  if (cached?.inputHash === inputHash && cached.projection) return projectionFromJson(cached.projection);
  if (cached?.failedInputHash === inputHash && cached.retryAt && cached.retryAt > new Date()) {
    if (cached.projection) return projectionFromJson(cached.projection);
    throw new TerritoryBudgetExceededError();
  }

  const cacheKey = `${seasonKey}:${inputHash}`;
  if (projectionCache?.key === cacheKey) return projectionCache.value;
  const value = (async () => {
    try {
      return await db.$transaction(async tx => {
        // Serialize cross-instance rebuilds for this season and re-check after acquiring the lock.
        // PostgreSQL returns void here, which Prisma cannot deserialize.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`territory-projection:${seasonKey}`}))::text`;
        const latest = await tx.territoryProjectionCache.findUnique({ where: { seasonKey } });
        if (latest?.inputHash === inputHash && latest.projection) return projectionFromJson(latest.projection);
        if (latest?.failedInputHash === inputHash && latest.retryAt && latest.retryAt > new Date()) {
          if (latest.projection) return projectionFromJson(latest.projection);
          throw new TerritoryBudgetExceededError();
        }

      const shapes = valid.length ? await tx.territoryClaim.findMany({
        where: { id: { in: valid.map(row => row.id) } }, select: { id: true, geometry: true, checkedAt: true },
      }) : [];
      const metadata = new Map(valid.map(row => [row.id, row]));
      const projection = replayClaims(shapes.flatMap(shape => {
        const row = metadata.get(shape.id);
        return row && shape.geometry && shape.checkedAt.getTime() === row.checkedAt.getTime() ? [{
          id: row.activityId, userId: row.activity.userId, endedAt: row.endedAt.toISOString(), geometry: shape.geometry as unknown as Shape,
        }] : [];
      }), { budgetMs: TERRITORY_REPLAY_BUDGET_MS });
      await tx.territoryProjectionCache.upsert({
        where: { seasonKey },
        create: { seasonKey, inputHash, projection: projection as unknown as Prisma.InputJsonValue },
        update: { inputHash, projection: projection as unknown as Prisma.InputJsonValue, failedInputHash: null, retryAt: null },
      });
      return projection;
      }, { timeout: 8000, maxWait: 500 });
    } catch (error) {
      if (!isTerritoryBudgetError(error)) throw error;
      const retryAt = new Date(Date.now() + TERRITORY_RETRY_SECONDS * 1000);
      // This breaker must commit separately: throwing inside the projection transaction rolls it back.
      await db.territoryProjectionCache.upsert({
        where: { seasonKey },
        create: { seasonKey, failedInputHash: inputHash, retryAt },
        update: { failedInputHash: inputHash, retryAt },
      });
      const latest = await db.territoryProjectionCache.findUnique({ where: { seasonKey } });
      if (latest?.projection) return projectionFromJson(latest.projection);
      throw error;
    }
  })();
  const entry: ProjectionCache = { key: cacheKey, value };
  projectionCache = entry;
  void value.catch(() => { if (projectionCache === entry) projectionCache = null; });
  return value;
}

export type ActivitySource = { summaryPolyline: string | null; sportType: string; startDate: Date; elapsedTime: number; distance: number };
export function sourceHash(activity: ActivitySource, rulesVersion = RULES_VERSION) {
  return createHash('sha256').update(JSON.stringify([activity.summaryPolyline, activity.sportType, activity.startDate.toISOString(), activity.elapsedTime, activity.distance, rulesVersion])).digest('hex');
}
export async function getSeason(now = new Date()) {
  const settings = await db.territorySettings.findUniqueOrThrow({ where: { id: 'revier' } });
  return seasonRange(settings.enabledAt, now);
}

async function stravaResource(stravaId: string, token: string, suffix = '') {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${encodeURIComponent(stravaId)}${suffix}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  if (res.status === 429) {
    const retry = res.headers.get('retry-after');
    const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 900;
    throw new RetryAfterError('Strava-Limit: Gebietsprüfung verschoben', `${Math.max(1, seconds)}s`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Strava-Gebietsprüfung fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function evaluateActivity(activityId: string) {
  const activity = await db.activity.findUnique({ where: { id: activityId } });
  if (!activity) return;
  const season = await getSeason();
  const hash = sourceHash(activity);
  const previous = await db.territoryClaim.findUnique({ where: { activityId } });
  if (previous?.sourceHash === hash && previous.checkedAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)) return;
  let reason: Reason | null = null;
  let geometry: Shape | null = null;
  let endedAt = new Date(activity.startDate.getTime() + activity.elapsedTime * 1000);
  if (!['Run', 'TrailRun'].includes(activity.sportType)) reason = 'SPORT';
  else if (activity.startDate < season.start || endedAt >= season.end || endedAt > new Date()) reason = 'OLD';
  else if (activity.stravaId.startsWith('health:')) reason = 'NO_GPS';
  else {
    const token = await getValidStravaToken(activity.userId);
    const detail = await stravaResource(activity.stravaId, token);
    if (!detail) reason = 'NO_GPS';
    else if (detail.manual || detail.trainer || detail.private || detail.visibility === 'only_me') reason = 'PRIVATE';
    else if (!['Run', 'TrailRun'].includes(detail.sport_type ?? detail.type)) reason = 'SPORT';
    else {
      const start = new Date(detail.start_date);
      endedAt = new Date(start.getTime() + Number(detail.elapsed_time) * 1000);
      if (!Number.isFinite(endedAt.getTime()) || Number(detail.elapsed_time) <= 0 || start < season.start || endedAt >= season.end || endedAt > new Date()) reason = 'OLD';
      else {
        const streams = await stravaResource(activity.stravaId, token, '/streams?keys=latlng,time&key_by_type=true');
        const result = evaluateLoop(streams?.latlng?.data ?? [], streams?.time?.data ?? [], Number(detail.distance));
        if (streams?.time?.data?.length && streams.time.data.at(-1) > Number(detail.elapsed_time) + 30) {
          result.geometry = null; result.reason = 'INVALID';
        }
        reason = result.reason;
        geometry = result.geometry;
      }
    }
  }
  // A stale HTTP response must never overwrite evaluation of a newer local route.
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${activity.id} FOR UPDATE`;
    const current = await tx.activity.findUnique({ where: { id: activity.id } });
    if (!current || sourceHash(current) !== hash) return;
    const data = { sourceHash: hash, rulesVersion: RULES_VERSION, status: geometry ? 'VALID' : 'REJECTED', reason,
      geometry: geometry ? geometry as unknown as Prisma.InputJsonValue : Prisma.DbNull, endedAt: Number.isFinite(endedAt.getTime()) ? endedAt : activity.startDate, checkedAt: new Date() };
    await tx.territoryClaim.upsert({ where: { activityId }, create: { ...data, activityId }, update: data });
  });
}

export async function getTerritoryData(userId: string): Promise<TerritoryData> {
  const now = new Date();
  const season = await getSeason(now);
  const rows = await db.territoryClaim.findMany({
    where: { endedAt: { gte: season.start, lt: season.end, lte: now }, activity: { startDate: { gte: season.start } } },
    select: { id: true, activityId: true, sourceHash: true, rulesVersion: true, status: true, reason: true, endedAt: true, checkedAt: true, activity: { select: { userId: true, name: true, stravaId: true, summaryPolyline: true, sportType: true, startDate: true, elapsedTime: true, distance: true,
      user: { select: { id: true, firstname: true, lastname: true } } } } },
  });
  const current = rows.filter(row => row.sourceHash === sourceHash(row.activity, row.rulesVersion));
  const valid = current.filter(row => row.status === 'VALID');
  // checkedAt changes during the daily Strava reconciliation even when the geometry is unchanged.
  // Key by the actual replay inputs so that reconciliation does not invalidate the shared snapshot.
  const key = createHash('sha256').update(JSON.stringify(valid.map(row => [row.id, row.sourceHash,
    row.endedAt.toISOString(), row.activity.userId]).sort((a, b) => a[0].localeCompare(b[0])))).digest('hex');
  const state = await getProjection(season.key, key, valid);
  const names = new Map(rows.map(row => [row.activity.userId, [row.activity.user.firstname, row.activity.user.lastname].filter(Boolean).join(' ') || 'DorfDüse']));
  const leaderboard = new Map<string, { userId: string; name: string; areaM2: number; count: number }>();
  for (const t of state.territories) {
    const entry = leaderboard.get(t.userId) ?? { userId: t.userId, name: names.get(t.userId) ?? 'DorfDüse', areaM2: 0, count: 0 };
    entry.areaM2 += t.areaM2; entry.count++;
    leaderboard.set(t.userId, entry);
  }
  const resultMap = new Map(state.results.map(result => [result.claimId, result]));
  const activityNames = new Map(current.map(row => [row.activityId, row.activity.name]));
  const presentEvent = (event: typeof state.events[number]) => ({
    ...event,
    fromName: event.fromUserId ? names.get(event.fromUserId) ?? 'DorfDüse' : null,
    toName: names.get(event.toUserId) ?? 'DorfDüse',
  });
  const histories = new Map<string, TerritoryData['territories'][number]['history']>();
  for (const event of state.events) {
    const history = histories.get(event.territoryId) ?? [];
    history.push(presentEvent(event));
    histories.set(event.territoryId, history);
  }
  const own = await db.activity.findMany({ where: { userId, sportType: { in: ['Run', 'TrailRun'] }, startDate: { gte: season.start, lt: season.end } },
    orderBy: [{ startDate: 'desc' }, { id: 'asc' }], take: 10, select: { id: true, name: true, stravaId: true, startDate: true, elapsedTime: true, distance: true, sportType: true, summaryPolyline: true, territoryClaim: { select: { sourceHash: true, rulesVersion: true, status: true, reason: true } } } });
  return {
    season: { key: season.key, start: season.start.toISOString(), end: season.end.toISOString() },
    myAreaM2: leaderboard.get(userId)?.areaM2 ?? 0,
    leaderboard: [...leaderboard.values()].sort((a, b) => b.areaM2 - a.areaM2 || a.userId.localeCompare(b.userId)),
    territories: state.territories.map(t => ({
      ...t, lastActivityName: activityNames.get(t.lastClaimId) ?? 'Lauf',
      history: histories.get(t.id) ?? [], ownerName: names.get(t.userId) ?? 'DorfDüse', mine: t.userId === userId,
    })),
    events: state.events.slice(-30).reverse().map(presentEvent),
    myRuns: own.map(a => {
      const evaluation = a.territoryClaim;
      const fresh = evaluation && evaluation.sourceHash === sourceHash(a, evaluation.rulesVersion);
      const result = resultMap.get(a.id);
      return { id: a.id, stravaId: a.stravaId, name: a.name, startDate: a.startDate.toISOString(),
        status: a.stravaId.startsWith('health:') ? 'REJECTED' : fresh ? evaluation.status : 'PENDING',
        message: a.stravaId.startsWith('health:') ? reasons.NO_GPS : !fresh ? 'Gebietsprüfung ausstehend.' : evaluation.reason ? reasons[evaluation.reason as Reason] ?? 'Keine gültige Runde.' :
          result && result.gainedM2 > 0 ? `${(result.gainedM2 / 1e6).toFixed(3)} km² eingenommen · ${result.capturedCount} Gebiete erobert` : 'Keine neue Fläche: Bestehende fremde Gebiete müssen vollständig umlaufen werden.',
        gainedM2: result?.gainedM2 ?? 0 };
    }),
  };
}

