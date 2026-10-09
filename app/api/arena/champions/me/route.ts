import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { weekRange, berlinMidnight, shiftDay } from '@/lib/time';
import { getWeeklyChampions } from '@/lib/arena/stats';

export async function GET() {
  await connection();
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers });
    const nextWeek = weekRange(weekRange().end).key;
    const range = weekRange();
    const historyStart = berlinMidnight(shiftDay(range.key, -28));
    const [champions, goals, activities] = await Promise.all([
      getWeeklyChampions(undefined, user.id),
      db.weeklyGoal.findMany({ where: { userId: user.id, weekKey: { in: [weekRange().key, nextWeek] } } }),
      db.activity.findMany({
        where: { userId: user.id, startDate: { gte: historyStart, lt: range.end }, movingTime: { gt: 0 } },
        select: { startDate: true, startDateLocal: true },
      }),
    ]);
    const days = new Map<string, Set<string>>();
    for (const activity of activities) {
      const key = weekRange(activity.startDate).key;
      const set = days.get(key) ?? new Set<string>();
      set.add(activity.startDateLocal.toISOString().slice(0, 10)); days.set(key, set);
    }
    return NextResponse.json({
      userId: user.id,
      nextWeek,
      activeDays: days.get(range.key)?.size ?? 0,
      previousDays: [-7, -14].map(offset => days.get(shiftDay(range.key, offset))?.size ?? 0),
      historyAvailable: user.createdAt <= historyStart,
      averageDays: [-7, -14, -21, -28].reduce((sum, offset) => sum + (days.get(shiftDay(range.key, offset))?.size ?? 0), 0) / 4,
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
