import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncUserActivities } from '@/lib/strava/sync';
import { requireSecret } from '@/lib/config';

export async function GET(request: Request) {
  let cronSecret: string;
  try {
    cronSecret = requireSecret('CRON_SECRET');
  } catch {
    return NextResponse.json({ error: 'Cron-Sync ist nicht konfiguriert' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
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
