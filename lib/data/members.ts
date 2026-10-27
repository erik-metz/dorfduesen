import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { cacheTags } from '@/lib/cache-tags';

export async function getMembers() {
  'use cache: remote';
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(cacheTags.members);
  return db.user.findMany({
    select: { id: true, firstname: true, lastname: true, username: true, profile: true, city: true },
    orderBy: [{ firstname: 'asc' }, { lastname: 'asc' }],
  });
}
