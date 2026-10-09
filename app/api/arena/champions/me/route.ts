import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getWeeklyChampions } from '@/lib/arena/stats';

export async function GET() {
  await connection();
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers });
    const champions = await getWeeklyChampions(undefined, user.id);
    return NextResponse.json({
      userId: user.id,
      values: Object.fromEntries(champions.map(champion => [champion.id, champion.winner?.value ?? 0])),
    }, { headers });
  } catch (error) {
    console.error('Fehler beim Laden des persönlichen Wochenstands:', error);
    return NextResponse.json({ error: 'Wochenstand konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
