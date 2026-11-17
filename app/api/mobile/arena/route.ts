import { isTerritoryBudgetError, TERRITORY_RETRY_SECONDS } from '@/lib/territory/budget';
import { getTerritoryData } from '@/lib/territory/service';
import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getArenaData } from '@/lib/arena/stats';
import { getRecentArenaActivities } from '@/lib/arena/recent-activities';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Mobile Arena payload with validated leaderboard filters. */
// Bound public reads independently of the long-running Inngest/coach handlers.
export const maxDuration = 10;

export async function GET(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401, headers });

  const { searchParams } = new URL(request.url);
  const rawPeriod = searchParams.get('period');
  const rawSport = searchParams.get('sport');
  const period = rawPeriod === 'month' || rawPeriod === 'all' ? rawPeriod : 'week';
  const sport = rawSport === 'run' || rawSport === 'ride' ? rawSport : 'all';

  try {
    const [arena, recentActivities, territories] = await Promise.all([
      getArenaData(period, sport),
      getRecentArenaActivities(),
      getTerritoryData(user.id),
    ]);
    return NextResponse.json({
      territories,
      filters: { period, sport },
      summary: {
        weekKm: arena.weekKm,
        weekHours: arena.weekHours,
        weekActivitiesCount: arena.weekActivitiesCount,
        activeAthletesCount: arena.activeAthletesCount,
      },
      challenge: arena.challenge,
      champions: arena.champions.map(champion => ({
        ...champion,
        winner: champion.winner ? { ...champion.winner, profile: sanitizeAvatarUrl(champion.winner.profile) } : null,
        recipients: champion.recipients?.map(recipient => ({ ...recipient, profile: sanitizeAvatarUrl(recipient.profile) })),
      })),
      leaderboard: arena.leaderboard.map(entry => ({ ...entry, profile: sanitizeAvatarUrl(entry.profile) })),
      recentActivities: recentActivities.map(activity => ({ ...activity, userProfile: sanitizeAvatarUrl(activity.userProfile) })),
      badges: arena.availableBadges,
    }, { headers });
  } catch (error) {
    if (isTerritoryBudgetError(error)) return NextResponse.json({ error: 'Die Revierkarte ist gerade nicht verfügbar. Bitte später erneut versuchen.' }, {
      status: 503, headers: { ...headers, 'Retry-After': String(TERRITORY_RETRY_SECONDS) },
    });
    console.error('Mobile Arena konnte nicht geladen werden:', error);
    return NextResponse.json({ error: 'Arena konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
