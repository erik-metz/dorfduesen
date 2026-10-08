import { inngest } from '../client';
import { syncUserActivities } from '@/lib/strava/sync';

export const syncUserFunction = inngest.createFunction({
  id: 'strava-sync-user',
  triggers: [{ event: 'strava/sync.requested' }],
  concurrency: { limit: 1, key: 'event.data.userId' },
  retries: 3,
}, async ({ event, step }) => step.run('sync', async () => {
  const result = await syncUserActivities(event.data.userId, 50);
  if (!result.success) throw new Error(result.error || 'Strava sync failed');
  return result;
}));
