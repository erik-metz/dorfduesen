import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getCommunityFeedData() {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(cacheTags.arena, cacheTags.members);

  const [rawActivities, groups, totals] = await Promise.all([
    db.activity.findMany({
      select: {
        id: true, stravaId: true, userId: true, name: true, distance: true,
        extractedDistance: true, manualDistance: true, sportType: true, startDate: true,
        user: { select: { firstname: true, lastname: true, username: true, profile: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 8,
    }),
    db.activity.groupBy({
      by: ['userId'],
      _sum: { distance: true },
      _count: { _all: true },
      orderBy: { _sum: { distance: 'desc' } },
      take: 3,
    }),
    db.activity.aggregate({ _sum: { distance: true } }),
  ]);

  const users = await db.user.findMany({
    where: { id: { in: groups.map((group) => group.userId) } },
    select: { id: true, firstname: true, lastname: true, username: true, profile: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return {
    recentActivities: rawActivities.map((activity) => ({
      id: activity.id,
      stravaId: activity.stravaId,
      userId: activity.userId,
      name: activity.name,
      distance: activity.manualDistance ?? activity.extractedDistance ?? activity.distance,
      sportType: activity.sportType,
      startDate: activity.startDate.toISOString(),
      userName: [activity.user.firstname, activity.user.lastname].filter(Boolean).join(' ') || activity.user.username || 'Dorfdüse',
      userProfile: activity.user.profile,
    })),
    topAthletes: groups.flatMap((group) => {
      const user = usersById.get(group.userId);
      return user ? [{
        userId: user.id,
        name: [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username || 'Dorfdüse',
        profile: user.profile,
        totalKm: (group._sum.distance || 0) / 1000,
        activityCount: group._count._all,
      }] : [];
    }),
    totalCommunityDistanceKm: (totals._sum.distance || 0) / 1000,
  };
}
