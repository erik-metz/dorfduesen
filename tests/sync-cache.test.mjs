import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

test('completed Strava import expires the shared arena cache immediately', async () => {
  const paths = [];
  const tags = [];
  const { finalizeSync } = loadTs('lib/strava/sync.ts', {
    '@/lib/db': { db: {} },
    './tokens': { getValidStravaToken: async () => 'unused' },
    '@/lib/inngest/client': { inngest: {} },
    'next/cache': {
      revalidatePath: path => paths.push(path),
      revalidateTag: (tag, profile) => tags.push({ tag, expire: profile.expire }),
    },
    '@/lib/arena/title-tracker': { checkWeeklyTitleChanges: async () => {} },
    '@/lib/arena/badge-engine': { evaluateUserBadges: async () => {} },
  });

  await finalizeSync('member');

  assert.ok(paths.includes('/arena'));
  assert.deepEqual(tags, [{ tag: 'arena', expire: 0 }]);
});
