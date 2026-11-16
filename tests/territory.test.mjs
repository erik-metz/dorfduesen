import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance } from '@turf/distance';
import { area } from '@turf/area';
import { difference } from '@turf/difference';
import { featureCollection, feature } from '@turf/helpers';
import { loadTs } from './load-ts.mjs';

const { evaluateLoop, replayClaims, seasonRange } = loadTs('lib/territory/engine.ts');
const square = (x = 8, y = 49, size = .005) => ({ type: 'Polygon', coordinates: [[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]] });
const claim = (id, userId, geometry, minute = 0) => ({ id, userId, geometry, endedAt: new Date(Date.UTC(2026, 10, 20, 12, minute)).toISOString() });
function stream(vertices) {
  const points = [];
  for (let v = 1; v < vertices.length; v++) {
    const a = vertices[v-1], b = vertices[v];
    const steps = Math.ceil(distance(a, b, { units: 'meters' }) / 40);
    for (let s = 0; s < steps; s++) points.push([a[1]+(b[1]-a[1])*s/steps, a[0]+(b[0]-a[0])*s/steps]);
  }
  points.push([vertices.at(-1)[1], vertices.at(-1)[0]]);
  const times = points.map((_, i) => i * 10);
  const meters = points.slice(1).reduce((sum,p,i) => sum + distance([points[i][1],points[i][0]], [p[1],p[0]], { units:'meters' }),0);
  return { points, times, meters };
}
function evaluate(vertices) { const s = stream(vertices); return evaluateLoop(s.points,s.times,s.meters); }

test('territory: full GPS round creates a polygon; a short closure is allowed', () => {
  const vertices = square().coordinates[0];
  assert.ok(evaluate(vertices).geometry);
  const open = vertices.slice(0,-1).concat([[8,49.0002]]);
  assert.ok(evaluate(open).geometry);
});
test('territory: open tracks, tiny loops, self intersections and out-and-back do not claim land', () => {
  assert.equal(evaluate(square().coordinates[0].slice(0,-1)).reason,'OPEN');
  assert.equal(evaluate(square(8,49,.0005).coordinates[0]).reason,'SMALL');
  assert.equal(evaluate([[8,49],[8.005,49.005],[8.005,49],[8,49.005],[8,49]]).reason,'CROSSED');
  assert.ok(evaluate([[8,49],[8.005,49],[8,49]]).reason);
});
test('territory: corrupt GPS, missing times, high speed and recording gaps are rejected', () => {
  const s = stream(square().coordinates[0]);
  assert.equal(evaluateLoop([],[],5000).reason,'NO_GPS');
  assert.equal(evaluateLoop(s.points,[],s.meters).reason,'INVALID');
  assert.equal(evaluateLoop(s.points,s.times.map((_,i)=>i),s.meters).reason,'INVALID');
  assert.equal(evaluateLoop([[49,8],[49,8.01],[49.01,8.01],[49,8]],[0,1000,2000,3000],5000).reason,'INVALID');
  const bad = structuredClone(s.points); bad[2][0] = NaN;
  assert.equal(evaluateLoop(bad,s.times,s.meters).reason,'INVALID');
});
test('territory: full enclosure transfers original territory and adds only free land', () => {
  const original = claim('a','alice',square());
  const enclosing = claim('b','bob',square(7.999,48.999,.007),1);
  const state = replayClaims([original,enclosing]);
  assert.ok(state.territories.every(t => t.userId === 'bob'));
  assert.equal(state.territories.find(t=>t.id==='a:0').originClaimId,'a');
  assert.equal(state.events.filter(e=>e.fromUserId === 'alice').length,1);
  assert.ok(Math.abs(state.territories.reduce((s,t)=>s+t.areaM2,0)-area(enclosing.geometry)) < 1);
  // Taking the same route again never creates more area.
  const again = replayClaims([original,enclosing,claim('c','bob',enclosing.geometry,2)]);
  assert.equal(again.territories.length,state.territories.length);
  assert.ok(again.results.at(-1).gainedM2 < 1);
});
test('territory: partial overlap keeps foreign land; inner loops cannot steal it', () => {
  const original = claim('a','alice',square());
  const crossing = claim('b','bob',square(8.0025,49,.005),1);
  const state = replayClaims([original,crossing]);
  assert.equal(state.territories[0].userId,'alice');
  assert.ok(state.territories.some(t=>t.userId==='bob'));
  assert.equal(state.events.filter(e=>e.fromUserId).length,0);
  const inner = replayClaims([original,claim('c','bob',square(8.001,49.001,.002),1)]);
  assert.equal(inner.territories.length,1);
  assert.equal(inner.results.at(-1).gainedM2,0);
  const t = state.territories;
  const remaining = difference(featureCollection([feature(t[0].geometry),feature(t[1].geometry)]));
  assert.ok(Math.abs(area(remaining)-t[0].areaM2) < 1);
});
test('territory: retry, late import, tie break, deletion and changes replay deterministically', () => {
  const a = claim('a','alice',square());
  const b = claim('b','bob',square(7.999,48.999,.007),1);
  assert.equal(JSON.stringify(replayClaims([b,a,a])),JSON.stringify(replayClaims([a,b])));
  const tie = replayClaims([claim('b','bob',square()),a]);
  assert.equal(tie.territories[0].userId,'bob');
  assert.ok(replayClaims([a]).territories.every(t=>t.userId==='alice'));
  assert.equal(replayClaims([a,claim('b','bob',square(8.02,49,.005),1)]).events.filter(e=>e.fromUserId).length,0);
});
test('territory: 10 meter tolerance captures a GPS-shifted matching round', () => {
  const state = replayClaims([claim('a','alice',square()),claim('b','bob',square(8.00002,49.00002),1)]);
  assert.equal(state.territories[0].userId,'bob');
});
test('territory: one round can capture multiple existing plots', () => {
  const state = replayClaims([claim('a','alice',square()),claim('b','bob',square(8.01,49),1),claim('c','carol',square(7.999,48.999,.02),2)]);
  assert.equal(state.results.at(-1).capturedCount,2);
  assert.ok(state.territories.every(t=>t.userId==='carol'));
});
test('territory: first season begins at activation; following quarters reset', () => {
  const enabled = new Date('2026-11-16T12:00:00Z');
  const initial = seasonRange(enabled,new Date('2026-11-20'));
  assert.equal(initial.start.toISOString(),enabled.toISOString());
  assert.equal(initial.end.toISOString(),'2027-01-01T00:00:00.000Z');
  const next = seasonRange(enabled,new Date('2027-01-01'));
  assert.equal(next.key,'2027-Q1');
  assert.equal(next.start.toISOString(),'2027-01-01T00:00:00.000Z');
});


test('territory: syncing a run schedules evaluation without an active training plan', async () => {
  const sent = [];
  const { syncUserActivities } = loadTs('lib/strava/sync.ts', {
    '@/lib/db': { db: {
      syncState: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) },
      trainingPlan: { findFirst: async () => null },
      territorySettings: { findUnique: async () => ({ enabledAt: new Date('2026-11-01') }) },
      activity: { upsert: async () => ({ id:'run-1' }) }, syncLog: { create: async () => ({}) },
    } },
    './tokens': { getValidStravaToken: async () => 'test' },
    '@/lib/inngest/client': { inngest: { send: async events => sent.push(...events) } },
    '@/lib/mobile/health-activities': { reconcileHealthActivities() {} },
    '@/lib/cache-tags': { cacheTags: {}, invalidateCacheTags() {} },
    fetch: async () => Response.json([{ id:123, name:'Rundlauf', distance:5000, moving_time:1800, elapsed_time:1800,
      total_elevation_gain:0, type:'Run', start_date:'2026-11-20T10:00:00Z',start_date_local:'2026-11-20T11:00:00Z' }]),
  });
  const result = await syncUserActivities('runner');
  assert.equal(result.success,true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].name,'territory/activity.check');
  assert.equal(sent[0].data.activityId,'run-1');
});
