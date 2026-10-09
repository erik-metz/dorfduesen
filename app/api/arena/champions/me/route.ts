import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { weekRange } from '@/lib/time';
import { getWeeklyChampions } from '@/lib/arena/stats';

export async function GET() {
  await connection();
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers });
    const nextWeek = weekRange(weekRange().end).key;
    const [champions, goals] = await Promise.all([
      getWeeklyChampions(undefined, user.id),
      db.weeklyGoal.findMany({ where: { userId: user.id, weekKey: { in: [weekRange().key, nextWeek] } } }),
    ]);
    return NextResponse.json({
      userId: user.id,
      nextWeek,
      nextGoal: goals.find(g => g.weekKey === nextWeek)?.activeDays ?? null,
      currentGoal: goals.find(g => g.weekKey === weekRange().key)?.activeDays ?? null,
      achievements: champions.filter(c => c.kind === 'recognition' && c.recipients?.some(r => r.userId === user.id)).map(c => c.title),
      values: Object.fromEntries(champions.map(champion => [champion.id, champion.winner?.value ?? 0])),
    }, { headers });
  } catch (error) {
    console.error('Fehler beim Laden des persönlichen Wochenstands:', error);
    return NextResponse.json({ error: 'Wochenstand konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
