import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
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
    await inngest.send({ name: 'strava/sync.all', data: {} });
    return NextResponse.json({ success: true, queued: true }, { status: 202 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Fehler beim Cron-Sync';
    console.error('Fehler im Cron-Sync-Handler:', error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
