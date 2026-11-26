import { inngest } from '../client';
import { db } from '@/lib/db';
import { adaptPlanAfterWeek } from '@/lib/training/adapt-plan';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

/** Weekly review of every active plan; only plans that fell behind are rebuilt. */
export const adaptPlansWeeklyFunction = inngest.createFunction(
  {
    id: 'adapt-training-plans-weekly',
    name: 'Adapt Training Plans to Last Week',
    triggers: [{ cron: 'TZ=Europe/Berlin 30 4 * * 1' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const plans = await step.run('find-active-plans', () => db.trainingPlan.findMany({
      where: { status: 'ACTIVE', endDate: { gt: new Date() } },
      select: { id: true, userId: true },
      take: 500,
    }));
    const results = [];
    for (const plan of plans) {
      // One step per plan: a failure stays isolated and is not recomputed for the others on retry.
      const result = await step.run(`adapt-${plan.id}`, async () => {
        const outcome = await adaptPlanAfterWeek(plan.id);
        if (outcome.status === 'adapted') invalidateCacheTags(cacheTags.userPlans(plan.userId), cacheTags.userNotifications(plan.userId), cacheTags.notifications);
        return outcome;
      });
      results.push({ planId: plan.id, ...result });
    }
    return { reviewed: plans.length, adapted: results.filter(result => result.status === 'adapted').length };
  },
);
