import { inngest } from '../client';
import { syncInstagramFeed } from '@/lib/instagram/feed';

export const syncInstagramFunction = inngest.createFunction(
  { id: 'sync-instagram-feed', concurrency: { limit: 1 },
    triggers: [{ cron: '0 * * * *' }, { event: 'instagram/feed.sync' }] },
  async ({ step }) => step.run('sync-instagram', syncInstagramFeed),
);
