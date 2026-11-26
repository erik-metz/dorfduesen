import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { revokeStravaToken } from '@/lib/strava/revoke';

export async function DELETE(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/i)?.[1];
  if (!bearerToken) return NextResponse.json({ error: 'Eine gültige App-Sitzung ist erforderlich.' }, { status: 401, headers });

  const confirmation = await request.json().catch(() => null) as { confirm?: unknown } | null;
  if (confirmation?.confirm !== true) {
    return NextResponse.json({ error: 'Bitte bestätige die Kontolöschung.' }, { status: 400, headers });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Die Sitzung ist abgelaufen. Bitte melde dich erneut an.' }, { status: 401, headers });

  const account = await db.account.findUnique({ where: { userId: user.id }, select: { refreshToken: true } });
  await revokeStravaToken(account?.refreshToken);

  await db.user.delete({ where: { id: user.id } });
  return NextResponse.json({ deleted: true }, { headers });
}
