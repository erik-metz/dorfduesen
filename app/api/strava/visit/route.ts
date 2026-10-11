import { NextResponse } from 'next/server';
import { queueSiteSync } from '@/lib/strava/queue';

export async function POST() {
  try {
    const result = await queueSiteSync();
    return NextResponse.json(result, { status: result.queued ? 202 : 200 });
  } catch (error) {
    console.error('Besuchsbasierter Strava-Sync fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Synchronisation konnte nicht gestartet werden' }, { status: 503 });
  }
}
