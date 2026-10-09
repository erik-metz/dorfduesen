import { db } from '@/lib/db';

export async function getDashboardActivities(userId: string, rawPage?: string, rawSport?: string) {
  const sport = rawSport === 'run' || rawSport === 'ride' ? rawSport : 'all';
  const pageSize = 100;
  const where = { userId, ...(sport === 'all' ? {} : { sportType: { contains: sport, mode: 'insensitive' as const } }) };
  const [totals, filteredCount] = await Promise.all([
    db.activity.aggregate({ where: { userId }, _sum: { distance: true, movingTime: true, totalElevationGain: true }, _count: { _all: true } }),
    db.activity.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize));
  const requested = Number(rawPage || 1);
  const page = Number.isSafeInteger(requested) ? Math.min(pageCount, Math.max(1, requested)) : 1;
  const activities = await db.activity.findMany({
    where, orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * pageSize, take: pageSize, omit: { detailJson: true },
  });
  return {
    activities,
    stats: { totalDistanceKm: (totals._sum.distance || 0) / 1000,
      totalHours: (totals._sum.movingTime || 0) / 3600,
      totalElevation: totals._sum.totalElevationGain || 0, activityCount: totals._count._all },
    pagination: { page, pageCount, pageSize, filteredCount, sport },
  };
}
