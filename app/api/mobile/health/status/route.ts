import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });

  const connections = await db.mobileHealthConnection.findMany({
    where: { userId: user.id },
    select: { provider: true, consentedTypes: true, consentVersion: true, consentedAt: true, revokedAt: true, lastSyncedAt: true },
  });
  return NextResponse.json({ connections }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
