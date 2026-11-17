import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

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
  if (account?.refreshToken && process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) {
    try {
      const credentials = Buffer.from(`${process.env.STRAVA_CLIENT_ID}:${process.env.STRAVA_CLIENT_SECRET}`).toString('base64');
      const revokeResponse = await fetch('https://www.strava.com/oauth/revoke', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: account.refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
      if (!revokeResponse.ok) console.error('Strava token revocation returned status:', revokeResponse.status);
    } catch (error) {
      console.error('Strava deauthorization request failed during account deletion:', error);
    }
  }

  await db.user.delete({ where: { id: user.id } });
  return NextResponse.json({ deleted: true }, { headers });
}
