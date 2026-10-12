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

test('failed Instagram import preserves stored feed and never logs tokens', async () => {
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const previousId = process.env.INSTAGRAM_USER_ID;
  process.env.INSTAGRAM_ACCESS_TOKEN = 'test-secret';
  process.env.INSTAGRAM_USER_ID = 'test-id';
  let writes = 0;
  const { syncInstagramFeed } = loadTs('lib/instagram/feed.ts', {
    'next/cache': { revalidateTag() {}, cacheLife() {}, cacheTag() {} },
    '@/lib/db': { db: { instagramFeedState: {
      findUnique: async () => null,
      upsert: async () => { writes++; },
    } } },
    fetch: async () => new Response('{}', { status: 401 }),
  });
  try {
    await assert.rejects(syncInstagramFeed(), /Instagram API request failed \(401\)/);
    assert.equal(writes, 0);
  } finally {
    if (previousToken === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN;
    else process.env.INSTAGRAM_ACCESS_TOKEN = previousToken;
    if (previousId === undefined) delete process.env.INSTAGRAM_USER_ID;
    else process.env.INSTAGRAM_USER_ID = previousId;
  }
});
