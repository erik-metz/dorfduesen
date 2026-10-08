import { inngest } from '../client';
import { finalizeWeeklyAwards, finalizeMonthlyAwards } from '@/lib/arena/awards-finalizer';

export const finalizeAwardsWeeklyFunction = inngest.createFunction(
  {
    id: 'finalize-weekly-awards',
    name: 'Finalize Weekly Champions & Crowns',
    triggers: [
      { cron: '5 0 * * 1' }, // Every Monday at 00:05
      { event: 'arena/awards.finalize_weekly' },
    ],
  },
  async ({ step }) => {
    const results = await step.run('finalize-weekly-champions', async () => {
      return await finalizeWeeklyAwards();
    });

    return { success: true, count: results.length, results };
  }
);

export const finalizeAwardsMonthlyFunction = inngest.createFunction(
  {
    id: 'finalize-monthly-awards',
    name: 'Finalize Monthly Champions & Century Club',
    triggers: [
      { cron: '10 0 1 * *' }, // 1st of every month at 00:10
      { event: 'arena/awards.finalize_monthly' },
    ],
  },
  async ({ step }) => {
    const results = await step.run('finalize-monthly-champions', async () => {
      return await finalizeMonthlyAwards();
    });

    return { success: true, count: results.length, results };
  }
);
