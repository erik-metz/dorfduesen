import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { getMobileAppRedirectUri, hashMobileSecret, makeMobileRedirectUrl } from '@/lib/auth/mobile-session';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = process.env.STRAVA_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const isMobile = searchParams.get('platform') === 'mobile';
  const requestedState = isMobile ? searchParams.get('state') : null;
  const codeChallenge = isMobile ? searchParams.get('code_challenge') : null;

  if (!clientId || clientId === 'your_strava_client_id') {
    if (isMobile && requestedState && /^[A-Za-z0-9-]{36}$/.test(requestedState)) {
      return NextResponse.redirect(makeMobileRedirectUrl(getMobileAppRedirectUri(), { state: requestedState, error: 'missing_credentials' }));
    }
    return NextResponse.json(
      {
        error: 'STRAVA_CLIENT_ID ist nicht konfiguriert. Bitte trage deine Strava App Credentials in .env ein.',
      },
      { status: 500 }
    );
  }

  const redirectUri = new URL('/api/auth/strava/callback', appUrl).toString();
  const state = requestedState ?? randomBytes(32).toString('base64url');

  if (isMobile) {
    const appRedirectUri = getMobileAppRedirectUri();
    if (!requestedState || !/^[A-Za-z0-9-]{36}$/.test(requestedState) || !codeChallenge || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
      return NextResponse.json({ error: 'Ungültige mobile OAuth-Anfrage.' }, { status: 400 });
    }
    await db.mobileOAuthState.create({
      data: {
        stateHash: hashMobileSecret(requestedState),
        codeChallenge,
        redirectUri: appRedirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await db.mobileOAuthState.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  } else {
    // Web OAuth uses a short-lived, httpOnly state cookie for CSRF protection.
    const cookieStore = await cookies();
    cookieStore.set('strava_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    });
  }

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
