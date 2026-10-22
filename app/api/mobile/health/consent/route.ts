import { NextResponse, connection } from 'next/server';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { HEALTH_RECORD_TYPES, isHealthProvider, isHealthRecordType, isJsonObject } from '@/lib/mobile/health';

const CONSENT_VERSION = '2026-10-22-v1';

export async function PUT(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 16_000) return NextResponse.json({ error: 'Anfrage zu groß.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) throw new Error();
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  if (!isHealthProvider(body.provider) || typeof body.accepted !== 'boolean') {
    return NextResponse.json({ error: 'Provider oder Einwilligungsstatus fehlt.' }, { status: 400 });
  }
  const types = body.types;
  if (body.accepted && (!Array.isArray(types) || types.length === 0 || types.length > HEALTH_RECORD_TYPES.length || !types.every(isHealthRecordType))) {
    return NextResponse.json({ error: 'Bitte nur unterstützte Datentypen freigeben.' }, { status: 400 });
  }
  const consentedTypes = body.accepted ? [...new Set(types as string[])] : [];
  const deleteRecords = body.deleteRecords === true;
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const connection = await tx.mobileHealthConnection.upsert({
      where: { userId_provider: { userId: user.id, provider: body.provider as string } },
      create: {
        userId: user.id,
        provider: body.provider as string,
        consentedTypes,
        consentVersion: body.accepted ? CONSENT_VERSION : null,
        consentedAt: body.accepted ? now : null,
        revokedAt: body.accepted ? null : now,
      },
      update: {
        consentedTypes,
        consentVersion: body.accepted ? CONSENT_VERSION : null,
        consentedAt: body.accepted ? now : null,
        revokedAt: body.accepted ? null : now,
        ...(!body.accepted ? { syncCursor: Prisma.DbNull } : {}),
      },
      select: { provider: true, consentedTypes: true, consentedAt: true, revokedAt: true },
    });
    if (deleteRecords) await tx.mobileHealthRecord.deleteMany({ where: { userId: user.id, provider: body.provider as string } });
    return connection;
  });

  return NextResponse.json({ connection: result, deleted: deleteRecords });
}
