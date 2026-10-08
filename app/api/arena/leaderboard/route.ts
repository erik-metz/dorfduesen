import { NextRequest, NextResponse, connection } from 'next/server';
import { getArenaLeaderboard } from '@/lib/arena/stats';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get('period');
    const rawSport = searchParams.get('sport');

    const period: 'week' | 'month' | 'all' =
      rawPeriod === 'month' || rawPeriod === 'all' ? rawPeriod : 'week';

    const sport: 'all' | 'run' | 'ride' =
      rawSport === 'run' || rawSport === 'ride' ? rawSport : 'all';

    const leaderboard = await getArenaLeaderboard(period, sport);

    return NextResponse.json({
      success: true,
      period,
      sport,
      leaderboard,
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Arena-Leaderboards:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden des Leaderboards' },
      { status: 500 }
    );
  }
}
