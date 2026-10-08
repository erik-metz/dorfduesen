import { db } from '@/lib/db';
import { BADGE_DEFINITIONS, ensureBadgesSeeded } from './badge-definitions';

export interface ChampionTitle {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  winner: {
    userId: string;
    name: string;
    profile: string | null;
    value: number;
    formattedValue: string;
  } | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  profile: string | null;
  totalDistanceKm: number;
  totalHours: number;
  totalElevation: number;
  activityCount: number;
  averagePace: string;
  badgesCount: number;
}

export interface TeamChallenge {
  title: string;
  description: string;
  targetKm: number;
  currentKm: number;
  percentage: number;
  daysRemaining: number;
}

export interface ArenaOverview {
  weekKm: number;
  weekHours: number;
  weekActivitiesCount: number;
  activeAthletesCount: number;
  champions: ChampionTitle[];
  challenge: TeamChallenge;
  leaderboard: LeaderboardEntry[];
  availableBadges: {
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
  }[];
}

export function getStartOfWeek(date: Date = new Date()): Date {
  const now = new Date(date);
  const day = now.getDay();
  // Monday is day 1, Sunday is day 0
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getWeekKey(date: Date = new Date()): string {
  return getStartOfWeek(date).toISOString().slice(0, 10);
}

export function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export function computeWeeklyChampions(
  weekActivities: Array<{
    startDateLocal: Date;
    distance: number;
    movingTime: number;
    totalElevationGain: number;
    averageHeartrate: number | null;
    user: {
      id: string;
      firstname: string | null;
      lastname: string | null;
      username: string | null;
      profile: string | null;
    };
  }>
): ChampionTitle[] {
  type UserMetric = {
    userId: string;
    name: string;
    profile: string | null;
    distance: number;
    elevation: number;
    time: number;
    maxHeartrate: number;
    earlyBirdKm: number;
    activeDays: Set<string>;
  };

  const userWeekMap: Record<string, UserMetric> = {};

  for (const act of weekActivities) {
    const u = act.user;
    const uName = [u.firstname, u.lastname].filter(Boolean).join(' ') || u.username || 'Athlet';

    if (!userWeekMap[u.id]) {
      userWeekMap[u.id] = {
        userId: u.id,
        name: uName,
        profile: u.profile,
        distance: 0,
        elevation: 0,
        time: 0,
        maxHeartrate: 0,
        earlyBirdKm: 0,
        activeDays: new Set<string>(),
      };
    }

    const m = userWeekMap[u.id];
    m.distance += act.distance;
    m.elevation += act.totalElevationGain;
    m.time += act.movingTime;

    if (act.averageHeartrate && act.averageHeartrate > m.maxHeartrate) {
      m.maxHeartrate = act.averageHeartrate;
    }

    // Early bird: Start before 08:00 AM local time
    const startHour = new Date(act.startDateLocal).getHours();
    if (startHour < 8) {
      m.earlyBirdKm += act.distance;
    }

    // Active day string (YYYY-MM-DD)
    const dayKey = new Date(act.startDateLocal).toISOString().slice(0, 10);
    m.activeDays.add(dayKey);
  }

  const userMetrics = Object.values(userWeekMap);

  const pickWinner = (
    predicate: (a: UserMetric) => number,
    formatter: (val: number) => string
  ) => {
    if (userMetrics.length === 0) return null;
    const sorted = [...userMetrics].sort((a, b) => predicate(b) - predicate(a));
    const best = sorted[0];
    const val = predicate(best);
    if (val <= 0) return null;
    return {
      userId: best.userId,
      name: best.name,
      profile: best.profile,
      value: val,
      formattedValue: formatter(val),
    };
  };

  return [
    {
      id: 'distance',
      title: 'Kilometer-König/in',
      subtitle: 'Meiste Distanz diese Woche',
      icon: '👑',
      winner: pickWinner(
        (m) => m.distance / 1000,
        (val) => `${val.toFixed(1)} km`
      ),
    },
    {
      id: 'elevation',
      title: 'Die Bergziege',
      subtitle: 'Meiste Höhenmeter erkämpft',
      icon: '⛰️',
      winner: pickWinner(
        (m) => m.elevation,
        (val) => `${Math.round(val)} m`
      ),
    },
    {
      id: 'time',
      title: 'Der Ausdauer-Büffel',
      subtitle: 'Meiste aktive Bewegungszeit',
      icon: '⏱️',
      winner: pickWinner(
        (m) => m.time / 3600,
        (val) => `${val.toFixed(1)} Std`
      ),
    },
    {
      id: 'heartrate',
      title: 'Die Eisenlunge',
      subtitle: 'Höchster Durchschnittspuls',
      icon: '💓',
      winner: pickWinner(
        (m) => m.maxHeartrate,
        (val) => `${Math.round(val)} bpm`
      ),
    },
    {
      id: 'early_bird',
      title: 'Der Frühaufsteher',
      subtitle: 'Meiste km vor 08:00 Uhr',
      icon: '🌅',
      winner: pickWinner(
        (m) => m.earlyBirdKm / 1000,
        (val) => `${val.toFixed(1)} km`
      ),
    },
    {
      id: 'consistency',
      title: 'Dauer-Düser',
      subtitle: 'Meiste aktive Trainingstage',
      icon: '📅',
      winner: pickWinner(
        (m) => m.activeDays.size,
        (val) => `${val} ${val === 1 ? 'Tag' : 'Tage'}`
      ),
    },
  ];
}

export async function getWeeklyChampions(startOfWeek = getStartOfWeek()): Promise<ChampionTitle[]> {
  const weekActivities = await db.activity.findMany({
    where: {
      startDate: { gte: startOfWeek },
    },
    include: {
      user: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          username: true,
          profile: true,
        },
      },
    },
  });

  return computeWeeklyChampions(weekActivities);
}

function formatRunPace(distanceMeters: number, movingSeconds: number): string {
  if (distanceMeters <= 0 || movingSeconds <= 0) return '-';
  const paceSeconds = movingSeconds / (distanceMeters / 1000);
  if (!isFinite(paceSeconds) || paceSeconds <= 0 || paceSeconds > 3600) return '-';
  let mins = Math.floor(paceSeconds / 60);
  let secs = Math.round(paceSeconds % 60);
  if (secs === 60) {
    mins += 1;
    secs = 0;
  }
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

function formatRideSpeed(distanceMeters: number, movingSeconds: number): string {
  if (distanceMeters <= 0 || movingSeconds <= 0) return '-';
  const hours = movingSeconds / 3600;
  const km = distanceMeters / 1000;
  const kmh = km / hours;
  if (!isFinite(kmh) || kmh <= 0) return '-';
  return `${kmh.toFixed(1)} km/h`;
}

export async function getArenaData(
  period: 'week' | 'month' | 'all' = 'week',
  sport: 'all' | 'run' | 'ride' = 'all'
): Promise<ArenaOverview> {
  const now = new Date();
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();

  // 1. Fetch current week's activities for Champions calculation & weekly KPI
  const weekActivities = await db.activity.findMany({
    where: {
      startDate: { gte: startOfWeek },
    },
    include: {
      user: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          username: true,
          profile: true,
        },
      },
    },
  });

  // Calculate weekly KPIs
  const weekKm = weekActivities.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const weekHours = weekActivities.reduce((sum, a) => sum + a.movingTime, 0) / 3600;
  const weekActivitiesCount = weekActivities.length;
  const activeAthletesCount = new Set(weekActivities.map((a) => a.userId)).size;

  // 2. Weekly Champions
  const champions = computeWeeklyChampions(weekActivities);

  // 3. Team-Challenge (Monthly 1,000 km mission)
  const monthActivities = await db.activity.findMany({
    where: { startDate: { gte: startOfMonth } },
    select: { distance: true },
  });

  const monthCurrentKm = monthActivities.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const targetKm = 1000;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - now.getDate());

  const challenge: TeamChallenge = {
    title: `Mission 1.000 km (${now.toLocaleString('de-DE', { month: 'long' })})`,
    description: 'Gemeinsames Club-Ziel: Zusammen schaffen wir 1.000 Kilometer durchs Ried!',
    targetKm,
    currentKm: monthCurrentKm,
    percentage: Math.min(100, (monthCurrentKm / targetKm) * 100),
    daysRemaining,
  };

  // 4. Leaderboard query for requested period & sport filter
  const leaderboard = await getArenaLeaderboard(period, sport);

  // 5. Ensure and provide full available Badges definition
  try {
    await ensureBadgesSeeded(db);
  } catch {
    // Continue if DB is warming up
  }
  const availableBadges = BADGE_DEFINITIONS;

  return {
    weekKm,
    weekHours,
    weekActivitiesCount,
    activeAthletesCount,
    champions,
    challenge,
    leaderboard,
    availableBadges,
  };
}

export async function getArenaLeaderboard(
  period: 'week' | 'month' | 'all' = 'week',
  sport: 'all' | 'run' | 'ride' = 'all'
): Promise<LeaderboardEntry[]> {
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();

  // Leaderboard query for requested period & sport filter
  const dateFilter =
    period === 'week'
      ? { gte: startOfWeek }
      : period === 'month'
      ? { gte: startOfMonth }
      : undefined;

  const sportFilter =
    sport === 'run'
      ? { contains: 'run', mode: 'insensitive' as const }
      : sport === 'ride'
      ? { contains: 'ride', mode: 'insensitive' as const }
      : undefined;

  const filteredActivities = await db.activity.findMany({
    where: {
      ...(dateFilter ? { startDate: dateFilter } : {}),
      ...(sportFilter ? { sportType: sportFilter } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          username: true,
          profile: true,
          _count: {
            select: { userBadges: true },
          },
        },
      },
    },
  });

  // Group by user
  const leaderboardMap: Record<
    string,
    {
      userId: string;
      name: string;
      profile: string | null;
      totalDistanceMeters: number;
      totalSeconds: number;
      totalElevation: number;
      activityCount: number;
      runDistanceMeters: number;
      runMovingSeconds: number;
      rideDistanceMeters: number;
      rideMovingSeconds: number;
      badgesCount: number;
    }
  > = {};

  for (const act of filteredActivities) {
    const u = act.user;
    const uName = [u.firstname, u.lastname].filter(Boolean).join(' ') || u.username || 'Athlet';

    if (!leaderboardMap[u.id]) {
      leaderboardMap[u.id] = {
        userId: u.id,
        name: uName,
        profile: u.profile,
        totalDistanceMeters: 0,
        totalSeconds: 0,
        totalElevation: 0,
        activityCount: 0,
        runDistanceMeters: 0,
        runMovingSeconds: 0,
        rideDistanceMeters: 0,
        rideMovingSeconds: 0,
        badgesCount: u._count.userBadges,
      };
    }

    const row = leaderboardMap[u.id];
    row.totalDistanceMeters += act.distance;
    row.totalSeconds += act.movingTime;
    row.totalElevation += act.totalElevationGain;
    row.activityCount += 1;

    const lowerSport = act.sportType?.toLowerCase() || '';
    if (lowerSport.includes('run')) {
      row.runDistanceMeters += act.distance;
      row.runMovingSeconds += act.movingTime;
    } else if (lowerSport.includes('ride')) {
      row.rideDistanceMeters += act.distance;
      row.rideMovingSeconds += act.movingTime;
    }
  }

  const leaderboard: LeaderboardEntry[] = Object.values(leaderboardMap)
    .sort((a, b) => b.totalDistanceMeters - a.totalDistanceMeters)
    .map((row, idx) => {
      let paceStr = '-';
      if (sport === 'run') {
        paceStr = formatRunPace(row.runDistanceMeters, row.runMovingSeconds);
      } else if (sport === 'ride') {
        paceStr = formatRideSpeed(row.rideDistanceMeters, row.rideMovingSeconds);
      } else {
        // sport === 'all': Never mix running and cycling!
        // Show pure running pace if athlete runs; or cycling speed if athlete only rides
        if (row.runDistanceMeters > 0) {
          paceStr = formatRunPace(row.runDistanceMeters, row.runMovingSeconds);
        } else if (row.rideDistanceMeters > 0) {
          paceStr = formatRideSpeed(row.rideDistanceMeters, row.rideMovingSeconds);
        }
      }

      return {
        rank: idx + 1,
        userId: row.userId,
        name: row.name,
        profile: row.profile,
        totalDistanceKm: row.totalDistanceMeters / 1000,
        totalHours: row.totalSeconds / 3600,
        totalElevation: row.totalElevation,
        activityCount: row.activityCount,
        averagePace: paceStr,
        badgesCount: row.badgesCount,
      };
    });

  return leaderboard;
}
