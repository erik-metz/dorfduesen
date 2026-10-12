import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { normalizeMedia } = loadTs('lib/instagram/media.ts');

test('Instagram supports photos, reels and mixed carousels in timestamp order', () => {
  const posts = normalizeMedia([
    { id: 'photo', media_type: 'IMAGE', media_url: 'https://cdn.example/photo.jpg', timestamp: '2026-10-10' },
    { id: 'reel', media_type: 'VIDEO', media_url: 'https://cdn.example/reel.mp4', thumbnail_url: 'https://cdn.example/poster.jpg', timestamp: '2026-10-12' },
    { id: 'album', media_type: 'CAROUSEL_ALBUM', children: { data: [
      { media_type: 'IMAGE', media_url: 'https://cdn.example/a.jpg' },
      { media_type: 'VIDEO', media_url: 'https://cdn.example/a.mp4' },
    ] } },
  ]);
  assert.equal(posts[0].id, 'reel');
  assert.equal(posts[0].media[0].type, 'VIDEO');
  assert.equal(posts[0].media[0].poster, 'https://cdn.example/poster.jpg');
  assert.equal(posts[2].media.length, 2);
  assert.equal(posts[2].images.length, 1);
});

test('Instagram drops unsupported or unsafe media and handles missing captions', () => {
  const posts = normalizeMedia([
    { id: 'unsafe', media_type: 'IMAGE', media_url: 'javascript:alert(1)' },
    { id: 'missing', media_type: 'VIDEO' },
    { id: 'valid', media_type: 'IMAGE', media_url: 'https://cdn.example/a.jpg', permalink: 'javascript:alert(1)' },
  ]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].caption, '');
  assert.equal(posts[0].permalink, undefined);
});

test('blocked public scrape preserves the previous feed without retries or credentials', async () => {
  let writes = 0;
  const { syncInstagramFeed } = loadTs('lib/instagram/feed.ts', {
    'next/cache': { revalidateTag() {}, cacheLife() {}, cacheTag() {} },
    '@/lib/db': { db: { instagramFeedState: { upsert: async () => { writes++; } } } },
    './scrape': { scrapeInstagramPosts: async () => { throw new Error('401'); } },
  });
  const result = await syncInstagramFeed();
  assert.equal(result.skipped, true);
  assert.equal(writes, 0);
});

const { parsePublicProfile, isInstagramScrapeDay } = loadTs('lib/instagram/scrape.ts');

test('public profile parser handles photos, reels, captions and mixed carousels', () => {
  const photo = { id: 'photo', shortcode: 'abc', display_url: 'https://cdn.example/a.jpg' };
  const video = { id: 'video', shortcode: 'def', is_video: true, video_url: 'https://cdn.example/a.mp4',
    display_url: 'https://cdn.example/poster.jpg', taken_at_timestamp: 1791763200,
    edge_media_to_caption: { edges: [{ node: { text: 'Laufen!' } }] } };
  const posts = parsePublicProfile({ data: { user: { edge_owner_to_timeline_media: { edges: [
    { node: photo }, { node: video }, { node: { id: 'album', edge_sidecar_to_children: { edges: [{ node: photo }, { node: video }] } } },
  ] } } } });
  assert.equal(posts.length, 3);
  assert.equal(posts[0].caption, 'Laufen!');
  assert.equal(posts[0].media[0].type, 'VIDEO');
  assert.equal(posts[0].permalink, 'https://www.instagram.com/p/def/');
  assert.equal(posts[2].media.length, 2);
});

test('empty, login, private and changed responses cannot clear the stored feed', () => {
  for (const payload of [null, {}, { data: { user: { is_private: true } } },
    { data: { user: { edge_owner_to_timeline_media: { edges: [] } } } }]) {
    assert.throws(() => parsePublicProfile(payload));
  }
});

test('successful public scrape persists posts and invalidates homepage feed cache', async () => {
  const writes = [];
  const tags = [];
  const { syncInstagramFeed, getInstagramPosts } = loadTs('lib/instagram/feed.ts', {
    'next/cache': { revalidateTag: tag => tags.push(tag), cacheLife() {}, cacheTag() {} },
    '@/lib/db': { db: { instagramFeedState: {
      upsert: async input => writes.push(input),
      findUnique: async () => ({ posts: [{ id: 'saved' }] }),
    } } },
    './scrape': { scrapeInstagramPosts: async () => [{ id: 'fresh', images: ['https://cdn.example/a.jpg'] }] },
  });
  assert.equal((await syncInstagramFeed()).count, 1);
  assert.equal(writes[0].update.posts[0].id, 'fresh');
  assert.deepEqual(tags, ['instagram-feed']);
  assert.equal((await getInstagramPosts())[0].id, 'saved');
});

test('scrape schedule keeps three days between attempts across month boundaries', () => {
  const start = Date.parse('2026-10-25T06:00:00Z');
  const scheduled = Array.from({ length: 20 }, (_, day) => start + day * 86400000).filter(isInstagramScrapeDay);
  for (let i = 1; i < scheduled.length; i++) assert.equal(scheduled[i] - scheduled[i - 1], 3 * 86400000);
});
