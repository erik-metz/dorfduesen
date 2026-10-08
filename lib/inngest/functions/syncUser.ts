import { inngest } from '../client';
import { db } from '@/lib/db';
import { syncUserActivities, finalizeSync } from '@/lib/strava/sync';
import { RetryAfterError } from 'inngest';

export const syncUserFunction = inngest.createFunction({
  id: 'strava-sync-user', triggers: [{ event: 'strava/sync.requested' }],
  concurrency: { limit: 1, key: 'event.data.userId' }, retries: 5,
}, async ({ event, step }) => {
  const userId = event.data.userId;
  const window = await step.run('prepare-window', async () => {
    const snapshot = Math.floor(Date.now() / 1000);
    await db.syncState.upsert({ where: { userId }, create: { userId, historicalBefore: snapshot }, update: {} });
    await db.syncState.updateMany({ where: { userId, historicalBefore: null }, data: { historicalBefore: snapshot } });
    const state = await db.syncState.findUniqueOrThrow({ where: { userId } });
    const historical = !state.historyCompletedAt;
    const before = historical ? state.historicalBefore! : snapshot;
    return { historical, page: historical ? state.historicalPage : 1, before,
      after: historical ? undefined : Math.floor((state.lastSyncedAt?.getTime() ?? Date.now() - 90 * 86400000) / 1000) - 7 * 86400 };
  });
  let count = 0;
  for (let page = window.page; ; page++) {
    const result = await step.run(`page-${page}`, async () => {
      const result = await syncUserActivities(userId, 100, { ...window, page });
      if (!result.success) {
        if (result.retryAt) throw new RetryAfterError(result.error || 'Sync delayed', new Date(result.retryAt));
        throw new Error(result.error || 'Sync failed');
      }
      return result;
    });
    count += result.count;
    if (!result.hasMore) break;
  }
  await step.run('finalize', () => finalizeSync(userId));
  return { success: true, count };
});
