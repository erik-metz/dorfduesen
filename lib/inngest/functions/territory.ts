import { inngest } from '../client';
import { db } from '@/lib/db';
import { evaluateActivity, getSeason } from '@/lib/territory/service';

export const evaluateTerritoryFunction = inngest.createFunction({
  id: 'territory-evaluate', triggers: [{ event: 'territory/activity.check' }],
  concurrency: [{ limit: 1, key: 'event.data.activityId' }, { limit: 2 }], retries: 5,
}, async ({ event, step }) => {
  await step.run('evaluate', () => evaluateActivity(event.data.activityId));
});

// Re-check authoritative details to discover privacy changes, edited GPS and remote deletions.
export const reconcileTerritoriesFunction = inngest.createFunction({
  id: 'territory-reconcile', triggers: [{ cron: 'TZ=Europe/Berlin 30 5 * * *' }, { event: 'territory/reconcile' }],
  concurrency: { limit: 1 },
}, async ({ step }) => {
  const season = await step.run('season', async () => {
    const season = await getSeason();
    return { start: season.start.toISOString(), end: season.end.toISOString() };
  });
  let cursor: string | undefined;
  for (let page = 0; ; page++) {
    const ids: string[] = await step.run(`page-${page}`, async () => (await db.activity.findMany({
      where: { sportType: { in: ['Run', 'TrailRun'] }, startDate: { gte: new Date(season.start), lt: new Date(season.end) }, stravaId: { not: { startsWith: 'health:' } } },
      orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true },
    })).map(row => row.id));
    if (!ids.length) break;
    await step.sendEvent(`check-${page}`, ids.map(activityId => ({ name: 'territory/activity.check', data: { activityId } })));
    cursor = ids[ids.length - 1];
    if (ids.length < 100) break;
  }
});
