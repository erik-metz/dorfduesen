import { weekRange, monthRange, shiftDay, berlinMidnight } from '@/lib/time';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { BADGE_DEFINITIONS, ensureBadgesSeeded } from './badge-definitions';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

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
      name: true,
      stravaId: true,
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

  // 2. Fetch existing badges for user
  const existingUserBadges = await db.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  });

  const existingMap = new Map(existingUserBadges.map((ub) => [ub.badge.code, ub]));

  // 3. Aggregate statistics
  let totalKm = 0;
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
  const monthlyWeekActivityCount = new Map<string, Map<string, number>>();

  for (const a of activities) {
    const isRun = ['Run', 'TrailRun', 'VirtualRun'].includes(a.sportType);
    const isRide = ['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'Handcycle', 'Velomobile'].includes(a.sportType);
    if (a.movingTime <= 0 || a.startDate > new Date()) continue;
    const localDate = new Date(a.startDateLocal || a.startDate);

    activityDates.push(localDate);
    totalKm += Math.max(0, a.distance) / 1000;

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
    if (isRun && localDate.getUTCDay() === 0) {
      const dayKey = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth() + 1}-${localDate.getUTCDate()}`;
      sundayDates.add(dayKey);
    }

    // Time of day checks
    const hour = localDate.getUTCHours();
    if ((isRun || isRide) && hour < 7) {
      earlyMorningCount++;
    }
    if (hour >= 21) {
      nightOwlCount++;
    }

    // Monthly aggregation
    const monthKey = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const currKm = monthlyKm.get(monthKey) || 0;
    monthlyKm.set(monthKey, currKm + a.distance / 1000);

    // Week in month approx
    const localDay = localDate.toISOString().slice(0, 10);
    const weekOfMonth = weekRange(berlinMidnight(localDay)).key;
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

  // Every calendar week intersecting a completed month must qualify.
  let hasMonthStreak = false;
  for (const [month, weekMap] of monthlyWeekActivityCount.entries()) {
    const range = monthRange(berlinMidnight(`${month}-01`));
    if (range.end > new Date()) continue;
    let qualifies = true;
    for (let key = weekRange(range.start).key; berlinMidnight(key) < range.end; key = shiftDay(key, 7)) {
      if ((weekMap.get(key) ?? 0) < 2) { qualifies = false; break; }
    }
    if (qualifies) { hasMonthStreak = true; break; }
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
      unlocked: activityDates.length >= 1,
      level: 1,
      metadata: { firstActivityDate: activities[0]?.startDate },
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

  // Keep a concrete source for the sport/time badges, including historical imports.
  const evidenceRules: Record<string, (a: typeof activities[number]) => boolean> = {
    CHAIN_RIGHT: a => ['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'Handcycle', 'Velomobile'].includes(a.sportType) && a.distance >= 50000,
    NIGHT_OWL: a => new Date(a.startDateLocal || a.startDate).getUTCHours() >= 21,
    DAWN_PATROL: a => ['Run', 'TrailRun', 'VirtualRun', 'Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'Handcycle', 'Velomobile'].includes(a.sportType) && new Date(a.startDateLocal || a.startDate).getUTCHours() < 7,
  };
  for (const cand of candidates) {
    const rule = evidenceRules[cand.code];
    const source = rule && activities.find(a => a.movingTime > 0 && a.startDate <= new Date() && rule(a));
    if (source) cand.metadata = { ...cand.metadata, activity: {
      id: source.id, stravaId: source.stravaId, name: source.name,
      sportType: source.sportType, distanceKm: Number((source.distance / 1000).toFixed(2)),
      localDate: new Date(source.startDateLocal || source.startDate).toISOString(),
    } };
  }

  const results: UnlockedBadgeResult[] = [];

  for (const cand of candidates) {
    const existing = existingMap.get(cand.code);
    if (!cand.unlocked) {
      if (existing) {
        await db.userBadge.deleteMany({ where: { id: existing.id, userId } });
        await db.notification.deleteMany({ where: { userId, type: 'BADGE_UNLOCKED',
          metadata: { path: ['code'], equals: cand.code } } });
      }
      continue;
    }

    const def = BADGE_DEFINITIONS.find((d) => d.code === cand.code);
    if (!def) continue;

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
    } else if (existing.level === cand.level) {
      await db.userBadge.update({ where: { id: existing.id },
        data: { metadata: cand.metadata as Prisma.InputJsonValue } });
    } else {
      // 2. Leveled up! (e.g. Century Club count increased or Sunday Warrior level upgraded)
      await db.userBadge.update({
        where: { id: existing.id },
        data: {
          level: cand.level,
          metadata: cand.metadata as Prisma.InputJsonValue,
        },
      });

      if (existing.level < cand.level) await db.notification.create({
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

  invalidateCacheTags(cacheTags.userTrophies(userId), cacheTags.notifications, cacheTags.userNotifications(userId), cacheTags.arena);
  return results;
}
