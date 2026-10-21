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
  const requestedUserId = searchParams.get('userId');
  const targetUser = requestedUserId && requestedUserId !== user.id
    ? await db.user.findUnique({ where: { id: requestedUserId }, select: { id: true, firstname: true, lastname: true, username: true, profile: true, city: true, country: true, _count: { select: { activities: true } } } })
    : user;
  if (!targetUser) return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404, headers });
  const isReadOnly = targetUser.id !== user.id;
  const range = weekRange();

  try {
    const nextWeek = weekRange(range.end);
    const [activityData, healthMetrics, activePlan, unreadNotifications, arena, champions, goals, weekActivities] = await Promise.all([
      getDashboardActivities(targetUser.id, page, sport, '20'),
      isReadOnly ? Promise.resolve([]) : db.healthMetric.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 5 }),
      isReadOnly ? Promise.resolve(null) : db.trainingPlan.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, currentWeek: true, totalWeeks: true, endDate: true },
      }),
      isReadOnly ? Promise.resolve(0) : db.notification.count({ where: { userId: user.id, isRead: false } }),
      getArenaData('week', 'all'),
      getWeeklyChampions(undefined, targetUser.id),
      db.weeklyGoal.findMany({ where: { userId: targetUser.id, weekKey: { in: [range.key, nextWeek.key] } } }),
      db.activity.findMany({
        where: { userId: targetUser.id, startDate: { gte: range.start, lt: range.end }, movingTime: { gt: 0 } },
        select: { startDateLocal: true },
      }),
    ]);

    return NextResponse.json({
      user: {
        id: targetUser.id,
        firstname: targetUser.firstname,
        lastname: targetUser.lastname,
        username: targetUser.username,
        profile: sanitizeAvatarUrl(targetUser.profile),
        city: 'city' in targetUser ? targetUser.city : null,
        country: 'country' in targetUser ? targetUser.country : null,
        activityCount: targetUser._count.activities,
        lastSync: !isReadOnly && 'account' in targetUser ? targetUser.account?.updatedAt ?? null : null,
      },
      isReadOnly,
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
