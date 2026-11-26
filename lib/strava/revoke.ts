/** Revoke a member's Strava authorization. Failures are logged and never block account removal. */
export async function revokeStravaToken(refreshToken: string | null | undefined): Promise<void> {
  if (!refreshToken || !process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) return;
  try {
    const credentials = Buffer.from(`${process.env.STRAVA_CLIENT_ID}:${process.env.STRAVA_CLIENT_SECRET}`).toString('base64');
    const revokeResponse = await fetch('https://www.strava.com/oauth/revoke', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: refreshToken, token_type_hint: 'refresh_token' }),
    });
    if (!revokeResponse.ok) console.error('Strava token revocation returned status:', revokeResponse.status);
  } catch (error) {
    console.error('Strava deauthorization request failed:', error);
  }
}
