import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { BADGE_DEFINITIONS } from '@/lib/arena/badge-definitions';
import { getWeeklyChampions } from '@/lib/arena/stats';
import { cacheTags } from '@/lib/cache-tags';

export async function getUserTrophies(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 10, revalidate: 20, expire: 60 });
  cacheTag(cacheTags.trophies, cacheTags.userTrophies(userId), cacheTags.arena);

  const [userBadges, weeklyHolders, monthlyHolders, liveChampions] = await Promise.all([
    db.userBadge.findMany({ where: { userId }, include: { badge: true } }),
    db.weeklyTitleHolder.findMany({ where: { userId }, orderBy: { weekKey: 'desc' } }),
    db.monthlyTitleHolder.findMany({ where: { userId }, orderBy: { monthKey: 'desc' } }),
    getWeeklyChampions(),
  ]);

  const userBadgeMap = new Map(userBadges.map((badge) => [badge.badge.code, badge]));
  const badges = BADGE_DEFINITIONS.map((definition) => {
    const userBadge = userBadgeMap.get(definition.code);
    return {
      ...definition,
      isUnlocked: Boolean(userBadge),
      level: userBadge?.level ?? 0,
      unlockedAt: userBadge?.unlockedAt?.toISOString() ?? null,
      metadata: userBadge?.metadata ?? null,
    };
  });
  const currentWeekLeaderTitles = liveChampions
    .filter((champion) => champion.recipients?.some((recipient) => recipient.userId === userId) || champion.winner?.userId === userId)
    .map((champion) => champion.id);

  return {
    success: true,
    badges,
    stats: {
      unlockedCount: userBadges.length,
      totalCount: BADGE_DEFINITIONS.length,
      weeklyCrownsCount: userBadges.filter((badge) => badge.badge.category === 'WEEKLY').reduce((sum, badge) => sum + badge.level, 0),
      monthlyAwardsCount: userBadges.filter((badge) => badge.badge.category === 'MONTHLY').reduce((sum, badge) => sum + badge.level, 0),
    },
    weeklyHolders,
    monthlyHolders,
    currentWeekLeaderTitles,
  };
}
