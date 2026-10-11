import { NextResponse } from 'next/server';
import { queueSiteSync } from '@/lib/strava/queue';
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
    const result = await queueSiteSync();
    return NextResponse.json({ success: true, ...result }, { status: result.queued ? 202 : 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Fehler beim Cron-Sync';
    console.error('Fehler im Cron-Sync-Handler:', error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
