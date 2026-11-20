import { randomUUID } from 'node:crypto';
import { NextResponse, connection } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { isHealthProvider, isHealthRecordType, isJsonObject, isSafeJson, parseDate } from '@/lib/mobile/health';
import { reconcileHealthActivities } from '@/lib/mobile/health-activities';
import { evaluateUserBadges } from '@/lib/arena/badge-engine';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

export const maxDuration = 20;

const MAX_BODY_BYTES = 1_500_000;
const MAX_BATCH_RECORDS = 500;
const ACTIVITY_SIGNAL_TYPES = ['distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance', 'heart_rate'];

export async function POST(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return NextResponse.json({ error: 'Synchronisierungspaket zu groß.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) throw new Error();
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Ungültiges Synchronisierungspaket.' }, { status: 400 });
  }
  if (body.accountId !== undefined && body.accountId !== user.id) {
    return NextResponse.json({ error: 'Das angemeldete Konto hat sich geändert.' }, { status: 403 });
  }
  const provider = body.provider;
  const records = body.records;
  const deletedRecordIds = body.deletedRecordIds ?? [];
  if (!isHealthProvider(provider) || !Array.isArray(records) || records.length > MAX_BATCH_RECORDS || !Array.isArray(deletedRecordIds) || deletedRecordIds.length > MAX_BATCH_RECORDS) {
    return NextResponse.json({ error: 'Provider oder Batchformat ungültig.' }, { status: 400 });
  }
  if (!deletedRecordIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200)) {
    return NextResponse.json({ error: 'Gelöschte Datensatz-IDs sind ungültig.' }, { status: 400 });
  }
  const link = await db.mobileHealthConnection.findUnique({ where: { userId_provider: { userId: user.id, provider } } });
  if (!link || link.revokedAt || !link.consentedAt) return NextResponse.json({ error: 'Für diesen Anbieter liegt keine aktive Zustimmung vor.' }, { status: 403 });

  const normalized: Array<{
    recordId: string; recordType: string; startAt: Date; endAt: Date | null;
    value: Prisma.InputJsonObject; sourceName: string | null; sourceId: string | null; recordedAt: Date | null;
  }> = [];
  for (const item of records) {
    if (!isJsonObject(item) || typeof item.recordId !== 'string' || item.recordId.length < 1 || item.recordId.length > 200 ||
        !isHealthRecordType(item.recordType) || !link.consentedTypes.includes(item.recordType) || !isSafeJson(item.value)) {
      return NextResponse.json({ error: 'Ein Datensatz ist ungültig oder nicht freigegeben.' }, { status: 400 });
    }
    const startAt = parseDate(item.startAt);
    const endAt = item.endAt == null ? null : parseDate(item.endAt);
    const recordedAt = item.recordedAt == null ? null : parseDate(item.recordedAt);
    if (!startAt || (item.endAt != null && !endAt) || (item.recordedAt != null && !recordedAt) || (endAt && endAt < startAt)) {
      return NextResponse.json({ error: 'Zeitangaben eines Datensatzes sind ungültig.' }, { status: 400 });
    }
    normalized.push({
      recordId: item.recordId,
      recordType: item.recordType,
      startAt,
      endAt,
      value: item.value as Prisma.InputJsonObject,
      sourceName: typeof item.sourceName === 'string' ? item.sourceName.slice(0, 160) : null,
      sourceId: typeof item.sourceId === 'string' ? item.sourceId.slice(0, 200) : null,
      recordedAt,
    });
  }
  const complete = body.complete ?? true;
  if (typeof complete !== 'boolean') {
    return NextResponse.json({ error: 'Synchronisierungsstatus ungültig.' }, { status: 400 });
  }
  const cursor = body.cursor === undefined ? undefined : body.cursor;
  if (cursor !== undefined && (!isJsonObject(cursor) || !isSafeJson(cursor, 8_000))) {
    return NextResponse.json({ error: 'Synchronisierungscursor ungültig.' }, { status: 400 });
  }

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    // Serialize writes with consent changes, including reconnects with a new scope.
    const active = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "MobileHealthConnection"
      WHERE "userId" = ${user.id} AND provider = ${provider}
        AND "revokedAt" IS NULL AND "consentedAt" = ${link.consentedAt}
      FOR UPDATE
    `;
    if (!active.length) return null;
    // A provider can repeat a record in one package. Keep the last value,
    // matching the previous sequential upserts.
    const uniqueRecords = [...new Map(normalized.map(record => [record.recordId, record])).values()];
    const rows = uniqueRecords.map(record => ({ id: randomUUID(), ...record }));
    const changed = rows.length ? await tx.$queryRaw<Array<{ recordType: string }>>`
      INSERT INTO "MobileHealthRecord" AS stored (
        id, "userId", provider, "recordId", "recordType", "startAt", "endAt",
        value, "sourceName", "sourceId", "recordedAt", "updatedAt"
      )
      SELECT input.id, ${user.id}, ${provider}, input."recordId", input."recordType",
        input."startAt", input."endAt", input.value, input."sourceName", input."sourceId",
        input."recordedAt", ${now}
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS input(
        id text, "recordId" text, "recordType" text, "startAt" timestamp, "endAt" timestamp,
        value jsonb, "sourceName" text, "sourceId" text, "recordedAt" timestamp
      )
      ON CONFLICT ("userId", provider, "recordId") DO UPDATE SET
        "recordType" = EXCLUDED."recordType", "startAt" = EXCLUDED."startAt", "endAt" = EXCLUDED."endAt",
        value = EXCLUDED.value, "sourceName" = EXCLUDED."sourceName", "sourceId" = EXCLUDED."sourceId",
        "recordedAt" = EXCLUDED."recordedAt", "updatedAt" = EXCLUDED."updatedAt"
      WHERE (stored."recordType", stored."startAt", stored."endAt", stored.value,
             stored."sourceName", stored."sourceId", stored."recordedAt")
        IS DISTINCT FROM (EXCLUDED."recordType", EXCLUDED."startAt", EXCLUDED."endAt", EXCLUDED.value,
                          EXCLUDED."sourceName", EXCLUDED."sourceId", EXCLUDED."recordedAt")
      RETURNING "recordType"
    ` : [];
    const deleted = deletedRecordIds.length
      ? (await tx.mobileHealthRecord.deleteMany({ where: { userId: user.id, provider, recordId: { in: deletedRecordIds as string[] } } })).count
      : 0;
    return { saved: uniqueRecords.length, changed, deleted };
  });
  if (result === null) return NextResponse.json({ error: 'Die Gesundheitsfreigabe hat sich geändert.' }, { status: 403 });
  const { saved, changed, deleted } = result;
  // Detect activity changes across all packages since the last completed sync.
  // Everyday heart-rate and distance samples only matter if they overlap a workout.
  const activityChanged = complete && (deleted > 0 || (await db.$queryRaw<[{ changed: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM "MobileHealthRecord" AS sample
      WHERE sample."userId" = ${user.id} AND sample.provider = ${provider}
        ${link.lastSyncedAt ? Prisma.sql`AND sample."updatedAt" > ${link.lastSyncedAt}` : Prisma.empty}
        AND (sample."recordType" = 'workout' OR (
          sample."recordType" IN (${Prisma.join(ACTIVITY_SIGNAL_TYPES)})
          AND EXISTS (
            SELECT 1 FROM "MobileHealthRecord" AS workout
            WHERE workout."userId" = sample."userId" AND workout.provider = sample.provider
              AND workout."recordType" = 'workout'
              AND workout."startAt" <= COALESCE(sample."endAt", sample."startAt") + interval '1 minute'
              AND COALESCE(workout."endAt", workout."startAt" + interval '1 day') >= sample."startAt" - interval '1 minute'
          )
        ))
    ) AS changed
  `)[0]?.changed);
  if (changed.length > 0 || deleted > 0) {
    invalidateCacheTags(cacheTags.userHealth(user.id), cacheTags.userProfile(user.id));
  }
  if (activityChanged) {
    await reconcileHealthActivities(user.id);
    try {
      await evaluateUserBadges(user.id);
    } catch (error) {
      console.error('Health-Aktivitäten wurden gespeichert, Trophäen konnten aber nicht aktualisiert werden:', error);
    }
    invalidateCacheTags(cacheTags.arena, cacheTags.userActivities(user.id), cacheTags.userTrophies(user.id));
    revalidatePath('/');
    revalidatePath('/arena');
    revalidatePath('/dashboard');
  }
  if (complete) {
    const updated = await db.mobileHealthConnection.updateMany({
      where: {
        userId: user.id, provider, revokedAt: null, consentedAt: link.consentedAt,
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: now } }],
      },
      data: { lastSyncedAt: now, ...(cursor === undefined ? {} : { syncCursor: cursor as object }) },
    });
    if (updated.count) invalidateCacheTags(cacheTags.userHealth(user.id));
  }
  return NextResponse.json({ saved, deleted, syncedAt: complete ? now.toISOString() : null });
}
