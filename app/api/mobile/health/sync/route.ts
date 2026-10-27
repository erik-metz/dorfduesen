import { NextResponse, connection } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { isHealthProvider, isHealthRecordType, isJsonObject, isSafeJson, parseDate } from '@/lib/mobile/health';
import { reconcileHealthActivities } from '@/lib/mobile/health-activities';
import { evaluateUserBadges } from '@/lib/arena/badge-engine';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

const MAX_BODY_BYTES = 1_500_000;
const MAX_BATCH_RECORDS = 500;

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
  const cursor = body.cursor === undefined ? undefined : body.cursor;
  if (cursor !== undefined && (!isJsonObject(cursor) || !isSafeJson(cursor, 8_000))) {
    return NextResponse.json({ error: 'Synchronisierungscursor ungültig.' }, { status: 400 });
  }

  const now = new Date();
  const saved = await db.$transaction(async (tx) => {
    for (const record of normalized) {
      await tx.mobileHealthRecord.upsert({
        where: { userId_provider_recordId: { userId: user.id, provider, recordId: record.recordId } },
        create: { userId: user.id, provider, ...record },
        update: { ...record },
      });
    }
    if (deletedRecordIds.length) {
      await tx.mobileHealthRecord.deleteMany({ where: { userId: user.id, provider, recordId: { in: deletedRecordIds as string[] } } });
    }
    await tx.mobileHealthConnection.update({
      where: { userId_provider: { userId: user.id, provider } },
      data: { lastSyncedAt: now, ...(cursor === undefined ? {} : { syncCursor: cursor as object }) },
    });
    return normalized.length;
  });
  const activityRecordsChanged = normalized.some(record => ['workout', 'distance', 'walking_running_distance', 'cycling_distance', 'swimming_distance', 'heart_rate'].includes(record.recordType)) || deletedRecordIds.length > 0;
  if (saved > 0 || deletedRecordIds.length > 0) {
    invalidateCacheTags(cacheTags.userHealth(user.id), cacheTags.userProfile(user.id));
  }
  if (activityRecordsChanged) {
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
  return NextResponse.json({ saved, deleted: deletedRecordIds.length, syncedAt: now.toISOString() });
}
