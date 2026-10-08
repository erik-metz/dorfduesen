import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getActivityDetails } from '@/lib/strava/activity-detail';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stravaId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const { stravaId } = await params;
    if (!stravaId) {
      return NextResponse.json({ error: 'Fehlende Strava ID' }, { status: 400 });
    }

    const detail = await getActivityDetails(user.id, stravaId);

    return NextResponse.json({
      success: true,
      activity: detail,
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Aktivitätsdetails:', error);
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
