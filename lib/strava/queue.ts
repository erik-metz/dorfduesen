import { db } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';

/** Atomic rolling cooldown shared by every visitor and server instance. */
export async function queueSiteSync(): Promise<{ queued: boolean }> {
  const owner = crypto.randomUUID();
  const claimed = await db.$executeRaw`
    INSERT INTO "SiteSyncState" ("id", "owner", "requestedAt")
    VALUES ('strava', ${owner}, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE
    SET "owner" = EXCLUDED."owner", "requestedAt" = EXCLUDED."requestedAt"
    WHERE "SiteSyncState"."requestedAt" <= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
  `;
  if (!claimed) return { queued: false };
  try {
    await inngest.send({ id: `site-sync:${owner}`, name: 'strava/sync.all', data: {} });
    return { queued: true };
  } catch (error) {
    // Failed enqueue must allow the next visitor to retry.
    await db.$executeRaw`DELETE FROM "SiteSyncState" WHERE "id" = 'strava' AND "owner" = ${owner}`;
    throw error;
  }
}
