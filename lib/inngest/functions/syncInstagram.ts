import { inngest } from '../client';
import { syncInstagramFeed } from '@/lib/instagram/feed';
import { isInstagramScrapeDay } from '@/lib/instagram/scrape';

export const syncInstagramFunction = inngest.createFunction(
  { id: 'sync-instagram-feed', concurrency: { limit: 1 }, retries: 0,
    triggers: [{ cron: '0 6 * * *' }, { event: 'instagram/feed.sync' }] },
  async ({ step, event }) => {
    if (event.name !== 'instagram/feed.sync' && !isInstagramScrapeDay(event.ts ?? Date.now())) {
      return { skipped: true, reason: 'Three-day interval' };
    }
    return step.run('scrape-instagram', syncInstagramFeed);
  },
);
