import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getArenaData } from '@/lib/arena/stats';
import { getRecentArenaActivities } from '@/lib/arena/recent-activities';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Mobile Arena payload with validated leaderboard filters. */
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
    const [arena, recentActivities] = await Promise.all([
      getArenaData(period, sport),
      getRecentArenaActivities(),
    ]);
    return NextResponse.json({
      filters: { period, sport },
      summary: {
        weekKm: arena.weekKm,
        weekHours: arena.weekHours,
        weekActivitiesCount: arena.weekActivitiesCount,
        activeAthletesCount: arena.activeAthletesCount,
      },
      challenge: arena.challenge,
      champions: arena.champions,
      leaderboard: arena.leaderboard,
      recentActivities,
      badges: arena.availableBadges,
    }, { headers });
  } catch (error) {
    console.error('Mobile Arena konnte nicht geladen werden:', error);
    return NextResponse.json({ error: 'Arena konnte nicht geladen werden.' }, { status: 500, headers });
  }
}
