import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { loadTs } from './load-ts.mjs';

const base = process.env.TEST_BASE_URL;
const url = process.env.TEST_DATABASE_URL;
if (!base || !url || !['localhost', '127.0.0.1'].includes(new URL(base).hostname) ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('HTTP smoke checks require explicit local TEST_BASE_URL and TEST_DATABASE_URL');
}
const db = new PrismaClient({ datasources: { db: { url } } });
const users = [];
try {
  for (let i = 0; ; i++) {
    try { await fetch(`${base}/api/auth/me`); break; }
    catch (error) { if (i === 20) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  const u = await db.user.create({ data: { stravaAthleteId: `http-${crypto.randomUUID()}` } });
  users.push(u.id);
  const other = await db.user.create({ data: { stravaAthleteId: `http-${crypto.randomUUID()}` } });
  users.push(other.id);
  const { createSessionToken } = loadTs('lib/auth/session.ts', { 'next/headers': {}, '@/lib/db': { db } });
  const token = await createSessionToken({ userId: u.id, stravaAthleteId: u.stravaAthleteId });
  const headers = { cookie: `dorfduesen_session=${token}`, 'content-type': 'application/json' };
  const api = (path, options = {}) => fetch(`${base}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  assert.equal((await fetch(`${base}/api/coach/plan`)).status, 401);
  assert.equal((await api('/api/auth/me')).status, 200);
  assert.equal((await api('/api/coach/profile', { method: 'POST', body: JSON.stringify({ maxHeartrate: -1 }) })).status, 400);
  assert.equal((await api('/api/coach/profile', { method: 'POST', body: JSON.stringify({ maxHeartrate: 185, restingHeartrate: 55 }) })).status, 200);
  assert.equal((await db.userProfile.findUnique({ where: { userId: u.id } })).maxHeartrate, 185);
  assert.equal((await api('/api/coach/plan', { method: 'POST', body: JSON.stringify({ goalType: 'invalid' }) })).status, 400);
  const data = { userId: u.id, title: 'Old plan', goalType: '5K', startDate: new Date(), endDate: new Date(Date.now() + 8 * 7 * 86400000), totalWeeks: 8 };
  const old = await db.trainingPlan.create({ data: { ...data, status: 'ACTIVE' } });
  const pending = await db.trainingPlan.create({ data: { ...data, title: 'Replacement', status: 'QUEUED' } });
  let response = await (await api('/api/coach/plan')).json();
  assert.equal(response.plan.id, old.id);
  assert.equal(response.generation.status, 'QUEUED');
  assert.equal((await api('/api/coach/plan', { method: 'POST', body: JSON.stringify({ goalType: '5K' }) })).status, 409);
  await db.trainingPlan.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
  response = await (await api('/api/coach/plan')).json();
  assert.equal(response.plan.id, old.id);
  assert.equal(response.generation.status, 'FAILED');
  await db.planGenerationAttempt.createMany({ data: Array.from({ length: 5 }, () => ({ userId: u.id })) });
  assert.equal((await api('/api/coach/plan', { method: 'DELETE' })).status, 200);
  assert.equal((await api('/api/coach/plan', { method: 'POST', body: JSON.stringify({ goalType: '5K' }) })).status, 429);
  const stravaId = `http-${crypto.randomUUID()}`;
  await db.activity.create({ data: { userId: other.id, stravaId, name: 'Shared activity', distance: 5000,
    movingTime: 1800, elapsedTime: 1800, totalElevationGain: 0, sportType: 'Run', startDate: new Date(), startDateLocal: new Date(),
    detailJson: { stravaId, name: 'Shared activity', averageHeartrate: 145 } } });
  assert.equal((await fetch(`${base}/api/strava/activities/${stravaId}`)).status, 401);
  const detail = await (await api(`/api/strava/activities/${stravaId}`)).json();
  assert.equal(detail.activity.averageHeartrate, 145); // intentional member-to-member sharing
  const leaderboard = await (await api('/api/arena/leaderboard?period=all&sport=run')).json();
  assert.equal(leaderboard.leaderboard.find(row => row.userId === other.id).totalDistanceKm, 5);
  assert.equal((await fetch(`${base}/api/strava/cron?secret=wrong`)).status, 401);
  console.log('HTTP smoke checks passed: auth, validation, preserved plan, failure status, quota and shared details.');
} finally {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
