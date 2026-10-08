import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!clientId || clientId === 'your_strava_client_id') {
    return NextResponse.json(
      {
        error: 'STRAVA_CLIENT_ID ist nicht konfiguriert. Bitte trage deine Strava App Credentials in .env ein.',
      },
      { status: 500 }
    );
  }

  // Generiere zufälligen State für CSRF-Schutz
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const cookieStore = await cookies();
  cookieStore.set('strava_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60, // 10 Minuten
    path: '/',
  });

  const redirectUri = `${appUrl}/api/auth/strava/callback`;
  const scope = 'read,activity:read_all';

  const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
  stravaAuthUrl.searchParams.set('client_id', clientId);
  stravaAuthUrl.searchParams.set('redirect_uri', redirectUri);
  stravaAuthUrl.searchParams.set('response_type', 'code');
  stravaAuthUrl.searchParams.set('approval_prompt', 'auto');
  stravaAuthUrl.searchParams.set('scope', scope);
  stravaAuthUrl.searchParams.set('state', state);

  return NextResponse.redirect(stravaAuthUrl.toString());
}
