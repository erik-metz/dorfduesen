import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getHealthStatus(userId: string, includeRecordTypes = false) {
  'use cache: remote';
  cacheLife({ stale: 600, revalidate: 600, expire: 1800 });
  cacheTag(cacheTags.userHealth(userId));
  const [connections, stored] = await Promise.all([
    db.mobileHealthConnection.findMany({ where: { userId }, select: { provider: true, consentedTypes: true, consentVersion: true, consentedAt: true, revokedAt: true, lastSyncedAt: true } }),
    includeRecordTypes
      ? db.mobileHealthRecord.groupBy({ by: ['recordType'], where: { userId }, _count: { _all: true } })
      : db.mobileHealthRecord.count({ where: { userId } }),
  ]);
  if (typeof stored === 'number') return { connections, storedRecordCount: stored };
  const recordTypes = stored.map(group => ({ type: group.recordType, count: group._count._all }));
  const storedRecordCount = recordTypes.reduce((total, item) => total + item.count, 0);
  return { connections, storedRecordCount, recordTypes };
}
