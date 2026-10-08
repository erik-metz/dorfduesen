import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { inngest } from '@/lib/inngest/client';

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    await inngest.send({ name: 'strava/sync.requested', data: { userId: user.id } });
    return NextResponse.json({ success: true, queued: true, message: 'Synchronisation gestartet' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Synchronisation konnte nicht gestartet werden' }, { status: 503 });
  }
}
