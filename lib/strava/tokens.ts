import { db } from '@/lib/db';

interface StravaTokenRefreshResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
}

export async function getValidStravaToken(userId: string): Promise<string> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE "userId" = ${userId} FOR UPDATE`;
    const account = await tx.account.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error(`Kein Strava-Account für Benutzer ${userId} gefunden.`);
    }

    const now = Math.floor(Date.now() / 1000);
    // Wenn der Token noch mindestens 5 Minuten gültig ist, verwenden wir ihn direkt
    if (account.expiresAt > now + 300) {
      return account.accessToken;
    }

    // Token ist abgelaufen oder läuft bald ab -> Refresh bei Strava
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('STRAVA_CLIENT_ID oder STRAVA_CLIENT_SECRET ist nicht konfiguriert.');
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fehler bei Strava Token-Refresh: ${response.status} ${errorText}`);
    }

    const refreshedData: StravaTokenRefreshResponse = await response.json();

    // Aktualisiere Tokens in der Datenbank
    await tx.account.update({
      where: { userId },
      data: {
        accessToken: refreshedData.access_token,
        refreshToken: refreshedData.refresh_token,
        expiresAt: refreshedData.expires_at,
      },
    });

    return refreshedData.access_token;
  }, { timeout: 20000, maxWait: 20000 });
}
