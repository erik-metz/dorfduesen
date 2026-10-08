import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { syncUserActivities } from '@/lib/strava/sync';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?auth_error=missing_code`);
  }

  // Überprüfe CSRF State
  const cookieStore = await cookies();
  const savedState = cookieStore.get('strava_oauth_state')?.value;
  cookieStore.delete('strava_oauth_state');

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/?auth_error=invalid_state`);
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?auth_error=missing_credentials`);
  }

  try {
    // Tausche authorization_code gegen Tokens
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Strava Token Exchange failed:', err);
      return NextResponse.redirect(`${appUrl}/?auth_error=token_exchange_failed`);
    }

    const data = await tokenResponse.json();
    const athlete = data.athlete;
    const stravaAthleteId = String(athlete.id);

    const sanitizedProfile = sanitizeAvatarUrl(athlete.profile || athlete.profile_medium);

    // Upsert User
    const user = await db.user.upsert({
      where: { stravaAthleteId },
      update: {
        firstname: athlete.firstname || null,
        lastname: athlete.lastname || null,
        username: athlete.username || null,
        profile: sanitizedProfile,
        city: athlete.city || null,
        country: athlete.country || null,
        sex: athlete.sex || null,
      },
      create: {
        stravaAthleteId,
        firstname: athlete.firstname || null,
        lastname: athlete.lastname || null,
        username: athlete.username || null,
        profile: sanitizedProfile,
        city: athlete.city || null,
        country: athlete.country || null,
        sex: athlete.sex || null,
      },
    });

    // Upsert OAuth Account Tokens
    await db.account.upsert({
      where: { userId: user.id },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        scope: searchParams.get('scope') || 'read,activity:read_all',
      },
      create: {
        userId: user.id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        scope: searchParams.get('scope') || 'read,activity:read_all',
      },
    });

    // Erzeuge Session Cookie
    const sessionToken = await createSessionToken({
      userId: user.id,
      stravaAthleteId: user.stravaAthleteId,
    });
    await setSessionCookie(sessionToken);

    // Revalidate public pages for the new member
    try {
      const { revalidatePath, revalidateTag } = await import('next/cache');
      revalidatePath('/arena');
      revalidatePath('/');
      revalidateTag('arena', { expire: 0 });
    } catch {
      // Ignored if outside context
    }

    // Starte Erst-Synchronisation der Aktivitäten im Hintergrund
    syncUserActivities(user.id).catch((syncErr) => {
      console.error('Initial background sync error:', syncErr);
    });

    return NextResponse.redirect(`${appUrl}/dashboard?login=success`);
  } catch (err) {
    console.error('Strava OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/?auth_error=server_error`);
  }
}
