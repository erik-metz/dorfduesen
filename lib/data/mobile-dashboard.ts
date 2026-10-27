import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getMobileTargetUser(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 60, expire: 180 });
  cacheTag(cacheTags.members, cacheTags.userProfile(userId), cacheTags.userActivities(userId));
  return db.user.findUnique({ where: { id: userId }, select: {
    id: true, firstname: true, lastname: true, username: true, profile: true, city: true, country: true,
    stravaAthleteId: true, _count: { select: { activities: true } },
  } });
}

export async function getMobileDashboardActivitySummary(
  targetUserId: string,
  weekStart: Date,
  weekEnd: Date,
  weekKey: string,
  nextWeekKey: string,
) {
  'use cache: remote';
  cacheLife({ stale: 10, revalidate: 15, expire: 60 });
  cacheTag(cacheTags.userActivities(targetUserId), cacheTags.userGoals(targetUserId), cacheTags.arena);
  const [goals, weekActivities] = await Promise.all([
    db.weeklyGoal.findMany({ where: { userId: targetUserId, weekKey: { in: [weekKey, nextWeekKey] } } }),
    db.activity.findMany({ where: { userId: targetUserId, startDate: { gte: weekStart, lt: weekEnd }, movingTime: { gt: 0 } }, select: { startDateLocal: true } }),
  ]);
  return { goals, weekActivities };
}

export async function getChampionMeActivitySummary(
  userId: string,
  historyStart: Date,
  rangeEnd: Date,
  currentWeekKey: string,
  nextWeekKey: string,
) {
  'use cache: remote';
  cacheLife({ stale: 15, revalidate: 30, expire: 120 });
  cacheTag(cacheTags.userActivities(userId), cacheTags.userGoals(userId));
  const [goals, activities] = await Promise.all([
    db.weeklyGoal.findMany({ where: { userId, weekKey: { in: [currentWeekKey, nextWeekKey] } } }),
    db.activity.findMany({ where: { userId, startDate: { gte: historyStart, lt: rangeEnd }, movingTime: { gt: 0 } }, select: { startDate: true, startDateLocal: true } }),
  ]);
  return { goals, activities };
}
