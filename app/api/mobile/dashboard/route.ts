import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getDashboardActivities } from '@/lib/data/dashboard';
import { db } from '@/lib/db';
import { weekRange } from '@/lib/time';
import { getArenaData, getWeeklyChampions } from '@/lib/arena/stats';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Compact authenticated overview for the mobile dashboard. Detailed sections
 * continue to use the existing activity, coach, trophy and notification APIs.
 */
export async function GET(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401, headers });

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? undefined;
  const sport = searchParams.get('sport') ?? undefined;
  const range = weekRange();

  try {
    const nextWeek = weekRange(range.end);
    const [activityData, healthMetrics, activePlan, unreadNotifications, arena, champions, goals, weekActivities] = await Promise.all([
      getDashboardActivities(user.id, page, sport, '20'),
      db.healthMetric.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 5 }),
      db.trainingPlan.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, currentWeek: true, totalWeeks: true, endDate: true },
      }),
      db.notification.count({ where: { userId: user.id, isRead: false } }),
      getArenaData('week', 'all'),
      getWeeklyChampions(undefined, user.id),
      db.weeklyGoal.findMany({ where: { userId: user.id, weekKey: { in: [range.key, nextWeek.key] } } }),
      db.activity.findMany({
        where: { userId: user.id, startDate: { gte: range.start, lt: range.end }, movingTime: { gt: 0 } },
        select: { startDateLocal: true },
      }),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username,
        profile: sanitizeAvatarUrl(user.profile),
        activityCount: user._count.activities,
        lastSync: user.account?.updatedAt ?? null,
      },
      activities: activityData.activities,
      stats: activityData.stats,
      pagination: activityData.pagination,
      physiology: { recentMetrics: healthMetrics },
      coach: { activePlan },
      notifications: { unreadCount: unreadNotifications },
      arena: {
        weekKm: arena.weekKm,
        weekActivitiesCount: arena.weekActivitiesCount,
        activeAthletesCount: arena.activeAthletesCount,
        challenge: arena.challenge,
        champions: champions.map(({ id, title, icon, winner, recipients }) => ({
          id,
          title,
          icon,
          isCurrentLeader: winner?.userId === user.id || Boolean(recipients?.some(recipient => recipient.userId === user.id)),
          value: winner?.userId === user.id ? winner.value : null,
        })),
        weeklyGoal: {
          activeDays: new Set(weekActivities.map(activity => activity.startDateLocal.toISOString().slice(0, 10))).size,
          targetActiveDays: goals.find(goal => goal.weekKey === range.key)?.activeDays ?? null,
          nextWeekTargetActiveDays: goals.find(goal => goal.weekKey === nextWeek.key)?.activeDays ?? null,
          weekKey: range.key,
          nextWeekKey: nextWeek.key,
        },
      },
    }, { headers });
  } catch (error) {
    console.error('Mobiles Dashboard konnte nicht geladen werden:', error);
    return NextResponse.json({ error: 'Dashboard konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
