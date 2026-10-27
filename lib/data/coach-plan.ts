import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';
import { DAILY_GENERATION_LIMIT } from '@/lib/training/plan-requests';

export async function getCoachPlanData(userId: string, dayStart: Date, dayEnd: Date) {
  'use cache: remote';
  cacheLife({ stale: 5, revalidate: 10, expire: 30 });
  cacheTag(cacheTags.userPlans(userId));
  const dayRange = { gte: dayStart, lt: dayEnd };
  const [plan, latest, generationsToday] = await Promise.all([
    db.trainingPlan.findFirst({
      where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' },
          include: {
            workouts: {
              orderBy: { scheduledDate: 'asc' },
              include: {
                matchedActivity: {
                  select: { id: true, stravaId: true, name: true, distance: true, movingTime: true, averageSpeed: true, averageHeartrate: true, startDate: true },
                },
              },
            },
          },
        },
      },
    }),
    db.trainingPlan.findFirst({ where: { userId, status: { in: ['ACTIVE', 'PROCESSING', 'QUEUED', 'FAILED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true } }),
    db.planGenerationAttempt.count({ where: { userId, createdAt: dayRange } }),
  ]);
  return { plan, generation: latest && latest.status !== 'ACTIVE' ? latest : null, generationsToday, dailyLimit: DAILY_GENERATION_LIMIT,
    remainingToday: Math.max(0, DAILY_GENERATION_LIMIT - generationsToday) };
}

export async function getActivePlanSummary(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 10, revalidate: 15, expire: 45 });
  cacheTag(cacheTags.userPlans(userId));
  return db.trainingPlan.findFirst({
    where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, status: true, currentWeek: true, totalWeeks: true, endDate: true },
  });
}
