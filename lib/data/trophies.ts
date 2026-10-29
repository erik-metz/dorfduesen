import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { BADGE_DEFINITIONS } from '@/lib/arena/badge-definitions';
import { getWeeklyChampions } from '@/lib/arena/stats';
import { cacheTags } from '@/lib/cache-tags';
import { TEAM_BADGE_PREFIX } from '@/lib/arena/team-challenge';

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
  const teamBadges = userBadges.filter(item => item.badge.code.startsWith(TEAM_BADGE_PREFIX))
    .sort((a, b) => b.badge.code.localeCompare(a.badge.code));
  const badges = BADGE_DEFINITIONS.filter(definition => definition.code !== 'MONTHLY_TEAM_1000' || !teamBadges.length).map((definition) => {
    const userBadge = userBadgeMap.get(definition.code);
    return {
      ...definition,
      isUnlocked: Boolean(userBadge),
      level: userBadge?.level ?? 0,
      unlockedAt: userBadge?.unlockedAt?.toISOString() ?? null,
      metadata: userBadge?.metadata ?? null,
    };
  });
  const collection = [...badges, ...teamBadges.map(item => ({
    ...item.badge,
    isUnlocked: true,
    level: 1,
    unlockedAt: item.unlockedAt.toISOString(),
    metadata: item.metadata,
  }))];
  const currentWeekLeaderTitles = liveChampions
    .filter((champion) => champion.recipients?.some((recipient) => recipient.userId === userId) || champion.winner?.userId === userId)
    .map((champion) => champion.id);

  return {
    success: true,
    badges: collection,
    stats: {
      unlockedCount: userBadges.length,
      totalCount: collection.length,
      weeklyCrownsCount: userBadges.filter((badge) => badge.badge.category === 'WEEKLY').reduce((sum, badge) => sum + badge.level, 0),
      monthlyAwardsCount: userBadges.filter((badge) => badge.badge.category === 'MONTHLY').reduce((sum, badge) => sum + badge.level, 0),
    },
    weeklyHolders,
    monthlyHolders,
    currentWeekLeaderTitles,
  };
}
