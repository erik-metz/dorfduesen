import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { createMobileAuthCode, hashMobileSecret, makeMobileRedirectUrl } from '@/lib/auth/mobile-session';
import { inngest } from '@/lib/inngest/client';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

function websiteRedirect(appUrl: string, error: string) {
  const url = new URL('/', appUrl);
  url.searchParams.set('auth_error', error);
  return NextResponse.redirect(url.toString());
}

function mobileRedirect(redirectUri: string, state: string, error: string) {
  return NextResponse.redirect(makeMobileRedirectUrl(redirectUri, { state, error }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const providerError = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  let mobileAttempt: { codeChallenge: string; redirectUri: string } | null = null;
  if (state) {
    const pending = await db.mobileOAuthState.findUnique({ where: { stateHash: hashMobileSecret(state) } });
    if (pending) {
      const claimed = await db.mobileOAuthState.deleteMany({ where: { id: pending.id, expiresAt: { gt: new Date() } } });
      if (claimed.count === 1) {
        mobileAttempt = { codeChallenge: pending.codeChallenge, redirectUri: pending.redirectUri };
      } else {
        return mobileRedirect(pending.redirectUri, state, 'invalid_state');
      }
    }
  }

  if (mobileAttempt) {
    if (providerError) return mobileRedirect(mobileAttempt.redirectUri, state!, 'access_denied');
    if (!code) return mobileRedirect(mobileAttempt.redirectUri, state!, 'missing_code');
  } else {
    if (providerError) return websiteRedirect(appUrl, providerError);
    if (!code) return websiteRedirect(appUrl, 'missing_code');

    const cookieStore = await cookies();
    const savedState = cookieStore.get('strava_oauth_state')?.value;
    cookieStore.delete('strava_oauth_state');
    if (!savedState || savedState !== state) return websiteRedirect(appUrl, 'invalid_state');
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return mobileAttempt
      ? mobileRedirect(mobileAttempt.redirectUri, state!, 'missing_credentials')
      : websiteRedirect(appUrl, 'missing_credentials');
  }

  try {
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      return mobileAttempt
        ? mobileRedirect(mobileAttempt.redirectUri, state!, 'token_exchange_failed')
        : websiteRedirect(appUrl, 'token_exchange_failed');
    }

    const data = await tokenResponse.json();
    const athlete = data.athlete;
    const stravaAthleteId = String(athlete.id);
    const sanitizedProfile = sanitizeAvatarUrl(athlete.profile || athlete.profile_medium);

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

    try {
      await inngest.send({ name: 'strava/sync.requested', data: { userId: user.id, historical: true } });
    } catch (syncErr) {
      console.error('Initial sync could not be queued:', syncErr);
    }

    if (mobileAttempt) {
      const mobileCode = await createMobileAuthCode(user.id, mobileAttempt.codeChallenge);
      return NextResponse.redirect(makeMobileRedirectUrl(mobileAttempt.redirectUri, { code: mobileCode, state: state! }));
    }

    const sessionToken = await createSessionToken({ userId: user.id, stravaAthleteId: user.stravaAthleteId });
    await setSessionCookie(sessionToken);

    try {
      const { revalidatePath } = await import('next/cache');
      const { cacheTags, invalidateCacheTags } = await import('@/lib/cache-tags');
      revalidatePath('/arena');
      revalidatePath('/');
      invalidateCacheTags(cacheTags.arena, cacheTags.members);
    } catch {
      // Ignored if outside context.
    }

    return NextResponse.redirect(new URL('/dashboard?login=success', appUrl).toString());
  } catch (err) {
    console.error('Strava OAuth callback error:', err);
    return mobileAttempt
      ? mobileRedirect(mobileAttempt.redirectUri, state!, 'server_error')
      : websiteRedirect(appUrl, 'server_error');
  }
}
