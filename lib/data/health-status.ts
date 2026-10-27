import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getHealthStatus(userId: string) {
  'use cache: remote';
  cacheLife({ stale: 3, revalidate: 5, expire: 15 });
  cacheTag(cacheTags.userHealth(userId));
  const [connections, storedRecordCount] = await Promise.all([
    db.mobileHealthConnection.findMany({ where: { userId }, select: { provider: true, consentedTypes: true, consentVersion: true, consentedAt: true, revokedAt: true, lastSyncedAt: true } }),
    db.mobileHealthRecord.count({ where: { userId } }),
  ]);
  return { connections, storedRecordCount };
}
