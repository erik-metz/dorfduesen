import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { isHealthProvider, isHealthRecordType, parseDate } from '@/lib/mobile/health';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';
import { reconcileHealthActivities } from '@/lib/mobile/health-activities';
import { evaluateUserBadges } from '@/lib/arena/badge-engine';

export const maxDuration = 15;

export async function GET(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const recordType = searchParams.get('type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const take = Math.min(500, Math.max(1, Math.trunc(Number(searchParams.get('limit') ?? 200)) || 200));
  const before = searchParams.get('before');
  const beforeId = searchParams.get('beforeId');
  const beforeDate = before ? parseDate(before) : null;
  const start = from ? parseDate(from) : null;
  const end = to ? parseDate(to) : null;
  if ((provider && !isHealthProvider(provider)) || (recordType && !isHealthRecordType(recordType)) || (from && !start) || (to && !end) || (start && end && end < start) || ((before || beforeId) && (!beforeDate || !beforeId || beforeId.length > 200))) {
    return NextResponse.json({ error: 'Filter sind ungültig.' }, { status: 400 });
  }
  const records = await db.mobileHealthRecord.findMany({
    where: {
      userId: user.id,
      ...(provider ? { provider } : {}),
      ...(recordType ? { recordType } : {}),
      ...(beforeDate && beforeId ? { OR: [
        { startAt: { lt: beforeDate } },
        { startAt: beforeDate, id: { lt: beforeId } },
      ] } : {}),
      ...(start || end ? { startAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
    },
    orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
  });
  const page = records.slice(0, take);
  const last = page.at(-1);
  const next = records.length > take && last ? { before: last.startAt.toISOString(), beforeId: last.id } : null;
  return NextResponse.json({ records: page, next }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function DELETE(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const recordType = searchParams.get('type');
  if ((provider && !isHealthProvider(provider)) || (recordType && !isHealthRecordType(recordType))) {
    return NextResponse.json({ error: 'Filter sind ungültig.' }, { status: 400 });
  }
  const result = await db.mobileHealthRecord.deleteMany({
    where: { userId: user.id, ...(provider ? { provider } : {}), ...(recordType ? { recordType } : {}) },
  });
  if (result.count) {
    await reconcileHealthActivities(user.id);
    try { await evaluateUserBadges(user.id); }
    catch (error) { console.error('Health-Daten wurden gelöscht, Trophäen konnten aber nicht aktualisiert werden:', error); }
    invalidateCacheTags(cacheTags.userHealth(user.id), cacheTags.userActivities(user.id), cacheTags.userTrophies(user.id), cacheTags.arena);
  }
  return NextResponse.json({ deleted: result.count });
}
