import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getHealthStatus(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 600, revalidate: 600, expire: 1800 });
  cacheTag(cacheTags.userHealth(userId));
  const [connections, storedRecordCount] = await Promise.all([
    db.mobileHealthConnection.findMany({ where: { userId }, select: { provider: true, consentedTypes: true, consentVersion: true, consentedAt: true, revokedAt: true, lastSyncedAt: true } }),
    db.mobileHealthRecord.count({ where: { userId } }),
  ]);
  return { connections, storedRecordCount };
}
