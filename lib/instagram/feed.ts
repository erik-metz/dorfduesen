import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import type { ClubPost } from '@/types/club';
import { scrapeInstagramPosts } from './scrape';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

const id = 'dorfduesen';

export async function syncInstagramFeed() {
  let posts: ClubPost[];
  try {
    posts = await scrapeInstagramPosts();
  } catch {
    console.warn('Instagram public scrape unavailable; keeping previous feed');
    return { skipped: true, reason: 'Instagram public access unavailable' };
  }
  const data = { posts: JSON.parse(JSON.stringify(posts)), syncedAt: new Date() };
  await db.instagramFeedState.upsert({ where: { id }, create: { id, ...data }, update: data });
  invalidateCacheTags(cacheTags.instagramFeed);
  return { success: true, count: posts.length };
}

export async function getInstagramPosts(): Promise<ClubPost[] | null> {
  'use cache: remote';
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag(cacheTags.instagramFeed);
  try {
    const state = await db.instagramFeedState.findUnique({ where: { id }, select: { posts: true } });
    return state ? state.posts as unknown as ClubPost[] : null;
  } catch {
    console.error('Instagram feed storage unavailable; using fallback gallery');
    return null;
  }
}
