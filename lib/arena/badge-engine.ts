import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { BADGE_DEFINITIONS, ensureBadgesSeeded } from './badge-definitions';

export interface UnlockedBadgeResult {
  code: string;
  name: string;
  icon: string;
  isNew: boolean;
  level: number;
}

/**
 * Calculates user's max consecutive activity days streak.
 */
function calculateMaxConsecutiveDays(dates: Date[]): number {
  if (dates.length === 0) return 0;
  // Sort distinct day strings (YYYY-MM-DD)
  const daySet = new Set(
    dates.map((d) => {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })
  );

  const sortedDays = Array.from(daySet).sort();
  if (sortedDays.length <= 1) return sortedDays.length;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Evaluates all milestone, streak, and community badges for a given athlete.
 * Persists unlocked badges in UserBadge and fires BADGE_UNLOCKED notifications.
 */
export async function evaluateUserBadges(userId: string): Promise<UnlockedBadgeResult[]> {
  await ensureBadgesSeeded(db);

  // 1. Fetch all athlete activities
  const activities = await db.activity.findMany({
    where: { userId },
    select: {
      id: true,
      distance: true,
      movingTime: true,
      totalElevationGain: true,
      sportType: true,
      startDate: true,
      startDateLocal: true,
      maxHeartrate: true,
    },
    orderBy: { startDate: 'asc' },
  });

  if (activities.length === 0) {
    return [];
  }

  // 2. Fetch existing badges for user
  const existingUserBadges = await db.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  });

  const existingMap = new Map(existingUserBadges.map((ub) => [ub.badge.code, ub]));

  // 3. Aggregate statistics
  const totalKm = activities.reduce((sum, a) => sum + a.distance, 0) / 1000;
  let maxRunDistance = 0;
  let maxRideDistance = 0;
  let maxElevation = 0;
  const sundayDates = new Set<string>();
  let earlyMorningCount = 0;
  let nightOwlCount = 0;
  const activityDates: Date[] = [];

  // Monthly buckets: YYYY-MM -> totalKm
  const monthlyKm = new Map<string, number>();
  // Monthly activities per week: YYYY-MM -> Map<weekNum, count>
  const monthlyWeekActivityCount = new Map<string, Map<number, number>>();

  for (const a of activities) {
    const isRun = a.sportType.toLowerCase().includes('run');
    const isRide = a.sportType.toLowerCase().includes('ride');
    const localDate = new Date(a.startDateLocal || a.startDate);

    activityDates.push(localDate);

    if (isRun && a.distance > maxRunDistance) {
      maxRunDistance = a.distance;
    }
    if (isRide && a.distance > maxRideDistance) {
      maxRideDistance = a.distance;
    }
    if (a.totalElevationGain > maxElevation) {
      maxElevation = a.totalElevationGain;
    }

    // Sunday check
    if (localDate.getUTCDay() === 0) {
      const dayKey = `${localDate.getFullYear()}-${localDate.getMonth() + 1}-${localDate.getDate()}`;
      sundayDates.add(dayKey);
    }

    // Time of day checks
    const hour = localDate.getHours();
    if (hour < 7) {
      earlyMorningCount++;
    }
    if (hour >= 21) {
      nightOwlCount++;
    }

    // Monthly aggregation
    const monthKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}`;
    const currKm = monthlyKm.get(monthKey) || 0;
    monthlyKm.set(monthKey, currKm + a.distance / 1000);

    // Week in month approx
    const weekOfMonth = Math.floor((localDate.getDate() - 1) / 7);
    if (!monthlyWeekActivityCount.has(monthKey)) {
      monthlyWeekActivityCount.set(monthKey, new Map());
    }
    const weekMap = monthlyWeekActivityCount.get(monthKey)!;
    weekMap.set(weekOfMonth, (weekMap.get(weekOfMonth) || 0) + 1);
  }

  const consecutiveDaysStreak = calculateMaxConsecutiveDays(activityDates);

  // Months with >= 100 km and >= 200 km
  const centuryMonths = Array.from(monthlyKm.entries()).filter(([, km]) => km >= 100);
  const doubleCenturyMonths = Array.from(monthlyKm.entries()).filter(([, km]) => km >= 200);

  // Month streaker: at least 1 month where weeks 0, 1, 2, 3 each have >= 2 activities
  let hasMonthStreak = false;
  for (const [, weekMap] of monthlyWeekActivityCount.entries()) {
    const weeksWithTwoPlus = Array.from(weekMap.values()).filter((c) => c >= 2).length;
    if (weeksWithTwoPlus >= 4) {
      hasMonthStreak = true;
      break;
    }
  }

  // 4. Candidate evaluations
  interface Candidate {
    code: string;
    unlocked: boolean;
    level: number;
    metadata?: Record<string, unknown>;
  }

  const candidates: Candidate[] = [
    {
      code: 'FIRST_DUESTE',
      unlocked: activities.length >= 1,
      level: 1,
      metadata: { firstActivityDate: activities[0].startDate },
    },
    {
      code: 'FIVE_K_BLAST',
      unlocked: maxRunDistance >= 5000,
      level: 1,
      metadata: { bestRunKm: (maxRunDistance / 1000).toFixed(2) },
    },
    {
      code: 'TEN_K_CLUB',
      unlocked: maxRunDistance >= 10000,
      level: 1,
      metadata: { bestRunKm: (maxRunDistance / 1000).toFixed(2) },
    },
    {
      code: 'HALF_MARATHON',
      unlocked: maxRunDistance >= 21097,
      level: 1,
      metadata: { bestRunKm: (maxRunDistance / 1000).toFixed(2) },
    },
    {
      code: 'MARATHON_HERO',
      unlocked: maxRunDistance >= 42195,
      level: 1,
      metadata: { bestRunKm: (maxRunDistance / 1000).toFixed(2) },
    },
    {
      code: 'MOUNTAIN_GOAT',
      unlocked: maxElevation >= 300,
      level: 1,
      metadata: { bestElevationMeters: Math.round(maxElevation) },
    },
    {
      code: 'LIFETIME_100K',
      unlocked: totalKm >= 100,
      level: 1,
      metadata: { totalKm: totalKm.toFixed(1) },
    },
    {
      code: 'LIFETIME_500K',
      unlocked: totalKm >= 500,
      level: 1,
      metadata: { totalKm: totalKm.toFixed(1) },
    },
    {
      code: 'LIFETIME_1000K',
      unlocked: totalKm >= 1000,
      level: 1,
      metadata: { totalKm: totalKm.toFixed(1) },
    },
    {
      code: 'SUNDAY_WARRIOR',
      unlocked: sundayDates.size >= 3,
      level: Math.min(3, Math.max(1, Math.floor(sundayDates.size / 3))),
      metadata: { sundayRoundsCount: sundayDates.size },
    },
    {
      code: 'SOFA_SURVIVOR',
      unlocked: consecutiveDaysStreak >= 3,
      level: 1,
      metadata: { maxStreakDays: consecutiveDaysStreak },
    },
    {
      code: 'DAWN_PATROL',
      unlocked: earlyMorningCount >= 1,
      level: 1,
      metadata: { earlyRunsCount: earlyMorningCount },
    },
    {
      code: 'NIGHT_OWL',
      unlocked: nightOwlCount >= 1,
      level: 1,
      metadata: { nightRunsCount: nightOwlCount },
    },
    {
      code: 'CHAIN_RIGHT',
      unlocked: maxRideDistance >= 50000,
      level: 1,
      metadata: { bestRideKm: (maxRideDistance / 1000).toFixed(2) },
    },
    {
      code: 'CENTURY_CLUB',
      unlocked: centuryMonths.length >= 1,
      level: Math.max(1, centuryMonths.length),
      metadata: { monthsAchieved: centuryMonths.map(([m, km]) => ({ month: m, km: km.toFixed(1) })) },
    },
    {
      code: 'DOUBLE_CENTURY',
      unlocked: doubleCenturyMonths.length >= 1,
      level: Math.max(1, doubleCenturyMonths.length),
      metadata: { monthsAchieved: doubleCenturyMonths.map(([m, km]) => ({ month: m, km: km.toFixed(1) })) },
    },
    {
      code: 'MONTH_STREAKER',
      unlocked: hasMonthStreak,
      level: 1,
      metadata: { consistencyMonthAchieved: true },
    },
  ];

  const results: UnlockedBadgeResult[] = [];

  for (const cand of candidates) {
    if (!cand.unlocked) continue;

    const def = BADGE_DEFINITIONS.find((d) => d.code === cand.code);
    if (!def) continue;

    const existing = existingMap.get(cand.code);

    if (!existing) {
      // 1. First time unlocked!
      const badgeDb = await db.badge.findUnique({ where: { code: cand.code } });
      if (!badgeDb) continue;

      await db.userBadge.create({
        data: {
          userId,
          badgeId: badgeDb.id,
          level: cand.level,
          metadata: cand.metadata as Prisma.InputJsonValue,
        },
      });

      // Notification
      await db.notification.create({
        data: {
          userId,
          type: 'BADGE_UNLOCKED',
          title: `${def.icon} Neues Abzeichen: ${def.name}!`,
          message: `Stark! Du hast das Badge "${def.name}" freigeschaltet. Schau es dir in deiner Trophäen-Vitrine an!`,
          link: '/dashboard?tab=trophies',
          metadata: {
            code: def.code,
            name: def.name,
            icon: def.icon,
            category: def.category,
            rarity: def.rarity,
          },
        },
      });

      results.push({
        code: def.code,
        name: def.name,
        icon: def.icon,
        isNew: true,
        level: cand.level,
      });
    } else if (existing.level < cand.level) {
      // 2. Leveled up! (e.g. Century Club count increased or Sunday Warrior level upgraded)
      await db.userBadge.update({
        where: { id: existing.id },
        data: {
          level: cand.level,
          metadata: cand.metadata as Prisma.InputJsonValue,
        },
      });

      await db.notification.create({
        data: {
          userId,
          type: 'BADGE_UNLOCKED',
          title: `⭐ Level-Up: ${def.name} (Stufe ${cand.level})!`,
          message: `Glückwunsch! Dein Badge "${def.name}" ist jetzt auf Stufe ${cand.level} gestiegen!`,
          link: '/dashboard?tab=trophies',
          metadata: {
            code: def.code,
            name: def.name,
            icon: def.icon,
            level: cand.level,
          },
        },
      });

      results.push({
        code: def.code,
        name: def.name,
        icon: def.icon,
        isNew: false,
        level: cand.level,
      });
    }
  }

  return results;
}
