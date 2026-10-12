import { cacheLife, cacheTag, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import type { ClubPost } from '@/types/club';
import { normalizeMedia, type InstagramMedia } from './media';

const id = 'dorfduesen';
const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children.limit(100){id,media_type,media_url,thumbnail_url}';

// Never log API URLs or response bodies: they can contain credentials.
async function request(url: URL, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Instagram API request failed (${response.status})`);
  return response.json();
}

export async function syncInstagramFeed() {
  const configuredToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!configuredToken || !userId) return { skipped: true, reason: 'Instagram credentials missing' };
  const state = await db.instagramFeedState.findUnique({ where: { id } });
  let token = state?.accessToken ?? configuredToken;
  let tokenUpdatedAt = state?.tokenUpdatedAt ?? new Date();
  if (state && Date.now() - tokenUpdatedAt.getTime() > 7 * 86400000) {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', token);
    const refreshed = await request(url, token);
    if (typeof refreshed.access_token !== 'string') throw new Error('Instagram token refresh returned no token');
    token = refreshed.access_token;
    tokenUpdatedAt = new Date();
    // Persist immediately, even if the following media request fails.
    await db.instagramFeedState.update({ where: { id }, data: { accessToken: token, tokenUpdatedAt } });
  }
  const url = new URL(`https://graph.instagram.com/v25.0/${encodeURIComponent(userId)}/media`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '12');
  const payload = await request(url, token);
  if (!Array.isArray(payload.data)) throw new Error('Instagram returned an invalid media response');
  const posts = normalizeMedia(payload.data as InstagramMedia[]);
  if (payload.data.length && !posts.length) throw new Error('Instagram returned no usable media');
  const data = { posts: JSON.parse(JSON.stringify(posts)), syncedAt: new Date(), accessToken: token, tokenUpdatedAt };
  await db.instagramFeedState.upsert({ where: { id }, create: { id, ...data }, update: data });
  revalidateTag('instagram-feed', { expire: 0 });
  return { success: true, count: posts.length };
}

export async function getInstagramPosts(): Promise<ClubPost[] | null> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag('instagram-feed');
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_USER_ID) return null;
  try {
    const state = await db.instagramFeedState.findUnique({ where: { id }, select: { posts: true } });
    return state ? state.posts as unknown as ClubPost[] : null;
  } catch {
    console.error('Instagram feed storage unavailable; using fallback gallery');
    return null;
  }
}
