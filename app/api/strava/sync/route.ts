import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { syncUserActivities } from '@/lib/strava/sync';

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const result = await syncUserActivities(user.id, 50);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Synchronisation fehlgeschlagen' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `${result.count} Aktivitäten erfolgreich synchronisiert`,
    count: result.count,
  });
}
