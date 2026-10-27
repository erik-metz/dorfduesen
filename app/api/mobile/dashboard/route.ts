import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getDashboardActivities } from '@/lib/data/dashboard';
import { weekRange } from '@/lib/time';
import { getArenaData, getWeeklyChampions } from '@/lib/arena/stats';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';
import { getActivePlanSummary } from '@/lib/data/coach-plan';
import { getMobileDashboardActivitySummary, getMobileTargetUser } from '@/lib/data/mobile-dashboard';
import { getCoachMetrics } from '@/lib/data/coach-profile';
import { getUnreadNotificationSummary } from '@/lib/data/notifications';

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
    ? await getMobileTargetUser(requestedUserId)
    : user;
  if (!targetUser) return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404, headers });
  const isReadOnly = targetUser.id !== user.id;
  const range = weekRange();

  try {
    const nextWeek = weekRange(range.end);
    const [activityData, healthMetrics, planData, notificationData, arena, champions, activitySummary] = await Promise.all([
      getDashboardActivities(targetUser.id, page, sport, '20'),
      isReadOnly ? Promise.resolve([]) : getCoachMetrics(user.id, 5),
      isReadOnly ? Promise.resolve({ plan: null }) : getActivePlanSummary(user.id).then(plan => ({ plan })),
      isReadOnly ? Promise.resolve({ unreadCount: 0, latestUnread: null }) : getUnreadNotificationSummary(user.id),
      getArenaData('week', 'all'),
      getWeeklyChampions(undefined, targetUser.id),
      getMobileDashboardActivitySummary(targetUser.id, range.start, range.end, range.key, nextWeek.key),
    ]);
    const { goals, weekActivities } = activitySummary;
    const activePlan = planData.plan;
    const unreadNotifications = notificationData.unreadCount;
    const latestUnread = notificationData.latestUnread;

    return NextResponse.json({
      user: {
        id: targetUser.id,
        firstname: targetUser.firstname,
        lastname: targetUser.lastname,
        username: targetUser.username,
        profile: sanitizeAvatarUrl(targetUser.profile),
        stravaAthleteId: targetUser.stravaAthleteId,
        city: 'city' in targetUser ? targetUser.city : null,
        country: 'country' in targetUser ? targetUser.country : null,
        activityCount: targetUser._count.activities,
        lastSync: isReadOnly ? null : user.account?.updatedAt ?? null,
      },
      isReadOnly,
      activities: activityData.activities,
      stats: activityData.stats,
      pagination: activityData.pagination,
      physiology: { recentMetrics: healthMetrics },
      coach: { activePlan },
      notifications: { unreadCount: unreadNotifications, latestUnread: latestUnread ? { title: latestUnread.title } : null },
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
