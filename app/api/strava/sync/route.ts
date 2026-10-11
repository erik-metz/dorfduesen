import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { queueSiteSync } from '@/lib/strava/queue';

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const result = await queueSiteSync();
    return NextResponse.json({ success: true, ...result }, { status: result.queued ? 202 : 200 });
  } catch {
    return NextResponse.json({ error: 'Synchronisation konnte nicht gestartet werden' }, { status: 503 });
  }
}
