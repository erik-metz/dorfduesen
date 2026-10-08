import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { evaluateUserBadges } from '@/lib/arena/badge-engine';

export async function POST() {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const results = await evaluateUserBadges(user.id);
    return NextResponse.json({
      success: true,
      newlyUnlockedCount: results.filter((r) => r.isNew).length,
      leveledUpCount: results.filter((r) => !r.isNew).length,
      badges: results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Auswertung fehlgeschlagen';
    console.error('Fehler bei manueller Badge-Auswertung:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
