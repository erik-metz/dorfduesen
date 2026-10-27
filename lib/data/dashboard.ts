import { db } from '@/lib/db';
import { cacheLife, cacheTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';

export async function getDashboardActivities(userId: string, rawPage?: string, rawSport?: string, rawPageSize?: string) {
  const sport = rawSport === 'run' || rawSport === 'ride' ? rawSport : 'all';
  const pageSize = rawPageSize === '50' ? 50 : rawPageSize === '100' ? 100 : 20;
  const requested = Number(rawPage || 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, requested) : 1;
  return getDashboardActivitiesCached(userId, page, sport, pageSize);
}

async function getDashboardActivitiesCached(userId: string, page: number, sport: 'all' | 'run' | 'ride', pageSize: number) {
  'use cache: remote';
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(cacheTags.userActivities(userId));
  const where = { userId, ...(sport === 'all' ? {} : { sportType: { contains: sport, mode: 'insensitive' as const } }) };
  const [totals, correctedActivities, filteredCount] = await Promise.all([
    db.activity.aggregate({ where: { userId }, _sum: { distance: true, movingTime: true, totalElevationGain: true }, _count: { _all: true } }),
    db.activity.findMany({ where: { userId, OR: [{ extractedDistance: { not: null } }, { manualDistance: { not: null } }] }, select: { distance: true, extractedDistance: true, manualDistance: true } }),
    db.activity.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize));
  const boundedPage = Math.min(pageCount, page);
  const activities = await db.activity.findMany({
    where, orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    skip: (boundedPage - 1) * pageSize, take: pageSize, omit: { detailJson: true },
  });
  const totalDistance = (totals._sum.distance || 0) + correctedActivities.reduce((sum, activity) => sum + (activity.manualDistance ?? activity.extractedDistance ?? activity.distance) - activity.distance, 0);
  return {
    activities: activities.map((activity) => ({ ...activity, distance: activity.manualDistance ?? activity.extractedDistance ?? activity.distance })),
    stats: { totalDistanceKm: totalDistance / 1000,
      totalHours: (totals._sum.movingTime || 0) / 3600,
      totalElevation: totals._sum.totalElevationGain || 0, activityCount: totals._count._all },
    pagination: { page: boundedPage, pageCount, pageSize, filteredCount, sport },
  };
}
