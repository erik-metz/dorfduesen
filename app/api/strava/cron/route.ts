import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncUserActivities } from '@/lib/strava/sync';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Wenn CRON_SECRET gesetzt ist, validiere den Zugriff
  if (cronSecret && cronSecret !== 'change-this-for-cron-sync-security') {
    const bearerToken = authHeader?.replace('Bearer ', '');
    const querySecret = searchParams.get('secret');

    if (bearerToken !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
  }

  try {
    // Finde alle Benutzer mit verknüpftem Strava-Account
    const accounts = await db.account.findMany({
      select: { userId: true },
    });

    const results = [];

    for (const acc of accounts) {
      const res = await syncUserActivities(acc.userId, 20);
      results.push({ userId: acc.userId, ...res });
    }

    return NextResponse.json({
      success: true,
      usersProcessed: accounts.length,
      results,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Fehler beim Cron-Sync';
    console.error('Fehler im Cron-Sync-Handler:', error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
