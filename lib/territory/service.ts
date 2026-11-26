import { isTerritoryBudgetError, TERRITORY_REPLAY_BUDGET_MS, TERRITORY_RETRY_SECONDS, TerritoryBudgetExceededError } from './budget';
import { formatArea, type TerritoryData } from './types';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getValidStravaToken } from '@/lib/strava/tokens';
import { RetryAfterError } from 'inngest';
import { evaluateLoop, GROUP_WINDOW_MS, reasons, replayClaims, REPLAY_VERSION, RULES_VERSION, seasonRange, type Claim, type Projection, type Reason, type Shape } from './engine';

// In-process promise deduplication is only an optimization. The shared projection lives in Postgres.
// claimKeys records exactly which claim inputs a projection contains, for the append-only fast path.
type TerritoryProjection = Projection & { claimKeys?: Record<string, string> };
type ProjectionCache = { key: string; value: Promise<TerritoryProjection> };
let projectionCache: ProjectionCache | null = null;

function projectionFromJson(value: Prisma.JsonValue): TerritoryProjection {
  return value as unknown as TerritoryProjection;
}

type ValidClaimRow = { id: string; activityId: string; sourceHash: string; checkedAt: Date; endedAt: Date; activity: { userId: string; startDate: Date } };
const claimKey = (row: ValidClaimRow) => `${row.sourceHash}|${row.endedAt.toISOString()}|${row.activity.userId}|${row.activity.startDate.toISOString()}`;

/** Base for an incremental replay: every stored claim unchanged, every new claim sorting after the stored cursor. */
function appendBase(projection: TerritoryProjection | null, valid: ValidClaimRow[]) {
  if (!projection || projection.version !== REPLAY_VERSION || !projection.claimKeys || !projection.cursor) return null;
  const keys = projection.claimKeys;
  const current = new Map(valid.map(row => [row.activityId, row]));
  for (const [id, key] of Object.entries(keys)) if (!current.has(id) || claimKey(current.get(id)!) !== key) return null;
  const cursor = projection.cursor;
  for (const row of valid) {
    if (keys[row.activityId]) continue;
    const endedAt = row.endedAt.toISOString();
    if (endedAt < cursor.endedAt || (endedAt === cursor.endedAt && row.activityId <= cursor.id)) return null;
  }
  return projection;
}

async function getProjection(seasonKey: string, inputHash: string, valid: ValidClaimRow[]) {
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

      const base = appendBase(latest?.projection ? projectionFromJson(latest.projection) : null, valid);
      // The append path needs the new shapes plus the earlier ones a group run can still match.
      const added = base ? valid.filter(row => !base.claimKeys![row.activityId]) : valid;
      const groupHorizon = Math.min(...added.map(row => row.endedAt.getTime())) - GROUP_WINDOW_MS;
      const needed = base ? valid.filter(row => !base.claimKeys![row.activityId] || row.endedAt.getTime() >= groupHorizon) : valid;
      const shapes = needed.length ? await tx.territoryClaim.findMany({
        where: { id: { in: needed.map(row => row.id) } }, select: { id: true, geometry: true, checkedAt: true },
      }) : [];
      const metadata = new Map(valid.map(row => [row.id, row]));
      const claims: Claim[] = [];
      const claimKeys: Record<string, string> = base ? { ...base.claimKeys } : {};
      for (const shape of shapes) {
        const row = metadata.get(shape.id);
        if (!row || !shape.geometry || shape.checkedAt.getTime() !== row.checkedAt.getTime()) continue;
        claims.push({ id: row.activityId, userId: row.activity.userId, endedAt: row.endedAt.toISOString(), startedAt: row.activity.startDate.toISOString(), geometry: shape.geometry as unknown as Shape });
        claimKeys[row.activityId] = claimKey(row);
      }
      const projection: TerritoryProjection = { ...replayClaims(claims, { budgetMs: TERRITORY_REPLAY_BUDGET_MS, base: base ?? undefined }), claimKeys };
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
  const key = createHash('sha256').update(JSON.stringify([REPLAY_VERSION, ...valid.map(row => [row.id, row.sourceHash,
    row.endedAt.toISOString(), row.activity.userId]).sort((a, b) => a[0].localeCompare(b[0]))])).digest('hex');
  const state = await getProjection(season.key, key, valid);
  const names = new Map(rows.map(row => [row.activity.userId, [row.activity.user.firstname, row.activity.user.lastname].filter(Boolean).join(' ') || 'DorfDüse']));
  const nameOf = (id: string) => names.get(id) ?? 'DorfDüse';
  // A stored projection from older replay rules can still be served during a cooling-off period.
  const ownersOf = (t: { userId: string; ownerIds?: string[] }) => t.ownerIds?.length ? t.ownerIds : [t.userId];
  const leaderboard = new Map<string, { userId: string; name: string; areaM2: number; count: number }>();
  for (const t of state.territories) for (const owner of ownersOf(t)) {
    const entry = leaderboard.get(owner) ?? { userId: owner, name: nameOf(owner), areaM2: 0, count: 0 };
    entry.areaM2 += t.areaM2; entry.count++;
    leaderboard.set(owner, entry);
  }
  const resultMap = new Map(state.results.map(result => [result.claimId, result]));
  const activityNames = new Map(current.map(row => [row.activityId, row.activity.name]));
  const ownEvents = state.events.filter(event => event.kind !== 'JOIN');
  const presentEvent = (event: typeof state.events[number]) => ({
    ...event,
    fromName: event.fromUserId ? nameOf(event.fromUserId) : null,
    toName: nameOf(event.toUserId),
  });
  const histories = new Map<string, TerritoryData['territories'][number]['history']>();
  for (const event of ownEvents) {
    const history = histories.get(event.territoryId) ?? [];
    history.push(presentEvent(event));
    histories.set(event.territoryId, history);
  }
  // One line per run, or per group run, instead of one per territory fragment.
  const changes = new Map<string, TerritoryData['changes'][number] & { runners: Set<string>; from: Set<string> }>();
  for (const event of state.events) {
    const groupId = resultMap.get(event.claimId)?.groupId ?? event.claimId;
    const change = changes.get(groupId) ?? { id: groupId, at: event.at, runnerNames: [], freeM2: 0, capturedM2: 0, fromNames: [], runners: new Set<string>(), from: new Set<string>() };
    change.runners.add(event.toUserId);
    if (event.at > change.at) change.at = event.at;
    if (event.kind === 'CAPTURE' || (!event.kind && event.fromUserId)) {
      change.capturedM2 += event.areaM2;
      for (const id of event.fromUserIds?.length ? event.fromUserIds : event.fromUserId ? [event.fromUserId] : []) change.from.add(id);
    } else if (event.kind !== 'JOIN') change.freeM2 += event.areaM2;
    changes.set(groupId, change);
  }
  const own = await db.activity.findMany({ where: { userId, sportType: { in: ['Run', 'TrailRun'] }, startDate: { gte: season.start, lt: season.end } },
    orderBy: [{ startDate: 'desc' }, { id: 'asc' }], take: 10, select: { id: true, name: true, stravaId: true, startDate: true, elapsedTime: true, distance: true, sportType: true, summaryPolyline: true, territoryClaim: { select: { sourceHash: true, rulesVersion: true, status: true, reason: true } } } });
  return {
    season: { key: season.key, start: season.start.toISOString(), end: season.end.toISOString() },
    myAreaM2: leaderboard.get(userId)?.areaM2 ?? 0,
    leaderboard: [...leaderboard.values()].sort((a, b) => b.areaM2 - a.areaM2 || a.userId.localeCompare(b.userId)),
    territories: state.territories.map(t => {
      const ownerNames = ownersOf(t).map(nameOf);
      return {
        ...t, ownerIds: ownersOf(t), ownerClaimIds: t.ownerClaimIds ?? [t.lastClaimId], lastActivityName: activityNames.get(t.lastClaimId) ?? 'Lauf',
        history: histories.get(t.id) ?? [], ownerNames,
        ownerName: ownerNames.length > 2 ? `${ownerNames.slice(0, 2).join(', ')} +${ownerNames.length - 2}` : ownerNames.join(', '),
        mine: ownersOf(t).includes(userId),
      };
    }),
    // Older app versions still render this list; joins would read as free land there.
    events: ownEvents.slice(-30).reverse().map(presentEvent),
    changes: [...changes.values()].filter(change => change.freeM2 + change.capturedM2 >= 1)
      .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)).slice(0, 10)
      .map(({ runners, from, ...change }) => ({ ...change, runnerNames: [...runners].map(nameOf), fromNames: [...from].filter(id => !runners.has(id)).map(nameOf) })),
    myRuns: own.map(a => {
      const evaluation = a.territoryClaim;
      const fresh = evaluation && evaluation.sourceHash === sourceHash(a, evaluation.rulesVersion);
      const result = resultMap.get(a.id);
      const groupSize = result ? new Set(state.results.filter(r => r.groupId === result.groupId).map(r => r.claimId)).size : 1;
      return { id: a.id, stravaId: a.stravaId, name: a.name, startDate: a.startDate.toISOString(),
        status: a.stravaId.startsWith('health:') ? 'REJECTED' : fresh ? evaluation.status : 'PENDING',
        message: a.stravaId.startsWith('health:') ? reasons.NO_GPS : !fresh ? 'Gebietsprüfung ausstehend.' : evaluation.reason ? reasons[evaluation.reason as Reason] ?? 'Keine gültige Runde.' :
          result && result.gainedM2 > 0 ? `${formatArea(result.gainedM2)} eingenommen${groupSize > 1 ? ` · Gruppenlauf mit ${groupSize} Läufern` : ''}` : 'Keine neue Fläche: Bestehende fremde Gebiete müssen vollständig umlaufen werden.',
        gainedM2: result?.gainedM2 ?? 0, groupSize };
    }),
  };
}
