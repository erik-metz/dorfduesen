import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

function route(profile, user = { id: 'athlete' }) {
  const now = new Date();
  const activities = [1, 3, 5].map(days => ({ startDate: new Date(now.getTime() - days * 86400000), sportType: 'Run', distance: 5000, movingTime: 1800, elapsedTime: 1820, averageHeartrate: 145, maxHeartrate: 175, totalElevationGain: 10 }));
  const db = {
    userProfile: { findUnique: async ({ where }) => { assert.equal(where.userId, 'athlete'); return profile; } },
    activity: { findMany: async ({ where }) => { assert.equal(where.userId, 'athlete'); return activities; } },
    healthMetric: { findMany: async ({ where }) => { assert.equal(where.userId, 'athlete'); return []; } },
  };
  return loadTs('app/api/coach/profile/route.ts', {
    '@/lib/auth/session': { getCurrentUser: async () => user },
    '@/lib/db': { db },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  });
}

test('coach VO2max requires authentication', async () => {
  const response = await route(null, null).GET();
  assert.equal(response.status, 401);
});

test('profile API returns separate VO2max and reconstructed history independent of manual VDOT', async () => {
  const profile = { maxHeartrate: 190, restingHeartrate: 50, vdotScore: 70 };
  const first = await (await route(profile).GET()).json();
  const second = await (await route({ ...profile, vdotScore: 30 }).GET()).json();
  assert.equal(first.calculatedVdot, 70);
  assert.equal(second.calculatedVdot, 30);
  assert.equal(first.vo2max.value, second.vo2max.value);
  assert.equal(first.vo2max.maxHrSource, 'profile');
  assert.equal(first.vo2max.method, 'oxygen-reserve');
  assert.equal(first.history.length, 26);
  assert.equal(first.history.at(-1).vo2max.maxHrSource, 'recorded');
});

test('profile API uses age when available and explicitly identifies the default otherwise', async () => {
  const aged = await (await route({ birthDate: new Date('1986-01-01') }).GET()).json();
  assert.equal(aged.vo2max.maxHrSource, 'age');
  const fallback = await (await route(null).GET()).json();
  assert.equal(fallback.vo2max.maxHrSource, 'default');
  assert.equal(fallback.vo2max.maxHr, 185);
});
