import { db } from '@/lib/db';
import { cacheLife, cacheTag } from 'next/cache';

export async function getRecentArenaActivities() {
  'use cache';
  cacheLife({ stale: 30, revalidate: 15, expire: 300 });
  cacheTag('arena');
  const activities = await db.activity.findMany({
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }], take: 20,
    select: { id: true, stravaId: true, name: true, sportType: true, distance: true,
      movingTime: true, startDate: true, userId: true,
      user: { select: { firstname: true, lastname: true, username: true, profile: true } } },
  });
  return activities.map(activity => ({
    id: activity.id, stravaId: activity.stravaId, name: activity.name,
    sportType: activity.sportType, distanceKm: activity.distance / 1000,
    movingTime: activity.movingTime, startDate: activity.startDate.toISOString(),
    userId: activity.userId,
    userName: [activity.user.firstname, activity.user.lastname].filter(Boolean).join(' ') || activity.user.username || 'Dorfdüse',
    userProfile: activity.user.profile,
  }));
}

export type RecentArenaActivity = Awaited<ReturnType<typeof getRecentArenaActivities>>[number];
