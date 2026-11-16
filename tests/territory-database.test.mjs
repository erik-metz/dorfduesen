import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { distance } from '@turf/distance';
import { loadTs } from './load-ts.mjs';

const url = process.env.TEST_DATABASE_URL;
if (url && (!['localhost','127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith('_test'))) throw new Error('Territory tests require a local _test database');

test('territory database: import → GPS evaluation → ownership → late capture → edit → deletion', { skip: !url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const users = [];
  const originalSettings = await db.territorySettings.findUniqueOrThrow({ where: { id: 'revier' } });
  const now = Date.now();
  assert.ok(originalSettings.enabledAt.getTime() <= now, 'Activation must not shift into the future on non-UTC database servers');
  const quarterStart = Date.UTC(new Date(now).getUTCFullYear(), Math.floor(new Date(now).getUTCMonth()/3)*3, 1);
  await db.territorySettings.update({ where: { id:'revier' }, data:{ enabledAt:new Date(quarterStart) } });
  const remote = new Map();
  let requests = 0;
  let remoteFailure = null;
  const { evaluateActivity, getTerritoryData } = loadTs('lib/territory/service.ts', {
    '@/lib/db': { db },
    '@/lib/strava/tokens': { getValidStravaToken: async () => 'test-token' },
    fetch: async input => {
      requests++;
      if (remoteFailure) return new Response('{}', { status: remoteFailure });
      const id = new URL(input).pathname.split('/')[4];
      const entry = remote.get(id);
      if (!entry) return new Response('{}',{status:404});
      return Response.json(input.includes('/streams?') ? entry.streams : entry.detail);
    },
  });
  async function activity(owner, id, size, minutesAgo) {
    const startDate = new Date(now - minutesAgo * 60000);
    const ring = [[8,49],[8+size,49],[8+size,49+size],[8,49+size],[8,49]];
    const points = [];
    for (let i=1;i<ring.length;i++) {
      const a=ring[i-1],b=ring[i];
      const count=Math.ceil(distance(a,b,{units:'meters'})/40);
      for (let k=0;k<count;k++) points.push([a[1]+(b[1]-a[1])*k/count,a[0]+(b[0]-a[0])*k/count]);
    }
    points.push([49,8]);
    const meters=points.slice(1).reduce((s,p,i)=>s+distance([points[i][1],points[i][0]],[p[1],p[0]],{units:'meters'}),0);
    const elapsedTime=points.length*10;
    const a = await db.activity.create({data:{userId:owner.id,stravaId:`revier-${id}-${crypto.randomUUID()}`,name:`Runde ${id}`,distance:meters,movingTime:elapsedTime,elapsedTime,totalElevationGain:0,sportType:'Run',startDate,startDateLocal:startDate,summaryPolyline:'source-a'}});
    remote.set(a.stravaId,{detail:{sport_type:'Run',start_date:startDate.toISOString(),elapsed_time:elapsedTime,distance:meters,private:false},streams:{latlng:{data:points},time:{data:points.map((_,i)=>i*10)}}});
    return a;
  }
  try {
    for (let i=0;i<2;i++) users.push(await db.user.create({data:{stravaAthleteId:`revier-test-${crypto.randomUUID()}`,firstname:i?'Bob':'Alice'}}));
    const a=await activity(users[0],'a',.005,120);
    const b=await activity(users[1],'b',.007,60);
    // Later run arrives first. Earlier imports must replay in actual completion order.
    await evaluateActivity(b.id);
    await evaluateActivity(a.id);
    let data=await getTerritoryData(users[0].id);
    assert.equal(data.myAreaM2,0);
    assert.ok(data.territories.every(t=>t.userId===users[1].id));
    assert.equal(data.events.filter(e=>e.fromUserId===users[0].id).length,1);
    assert.equal(data.myRuns[0].status,'VALID');
    const initialRequests=requests;
    await Promise.all([evaluateActivity(a.id),evaluateActivity(a.id)]);
    assert.equal(await db.territoryClaim.count({where:{activityId:a.id}}),1);
    assert.equal(requests,initialRequests); // Repeated sync does not spend more API calls today.
    await db.territoryClaim.update({where:{activityId:a.id},data:{checkedAt:new Date(now-2*86400000)}});
    await Promise.all([evaluateActivity(a.id),evaluateActivity(a.id)]);
    assert.equal(await db.territoryClaim.count({where:{activityId:a.id}}),1);
    // Transient API failures must preserve the last valid claim for a durable retry.
    await db.territoryClaim.update({where:{activityId:a.id},data:{checkedAt:new Date(now-2*86400000)}});
    remoteFailure=500;
    await assert.rejects(evaluateActivity(a.id), /500/);
    remoteFailure=429;
    await assert.rejects(evaluateActivity(a.id), /Strava-Limit/);
    remoteFailure=null;
    assert.equal((await db.territoryClaim.findUnique({where:{activityId:a.id}})).status,'VALID');
    // Changed local route is immediately excluded until its new evaluation is ready.
    await db.activity.update({where:{id:b.id},data:{summaryPolyline:'changed'}});
    data=await getTerritoryData(users[0].id);
    assert.ok(data.myAreaM2>0);
    remote.get(b.stravaId).detail.private=true;
    await evaluateActivity(b.id);
    assert.equal((await db.territoryClaim.findUnique({where:{activityId:b.id}})).reason,'PRIVATE');
    data=await getTerritoryData(users[0].id);
    assert.ok(data.territories.every(t=>t.userId===users[0].id));
    // Daily reconciliation discovers remotely deleted activities.
    remote.delete(a.stravaId);
    await db.territoryClaim.update({where:{activityId:a.id},data:{checkedAt:new Date(now-2*86400000)}});
    await evaluateActivity(a.id);
    assert.equal((await getTerritoryData(users[0].id)).territories.length,0);
    // Local deletions cascade, so stale geometry cannot survive deleted activity rows.
    await db.activity.delete({where:{id:a.id}});
    assert.equal(await db.territoryClaim.count({where:{activityId:a.id}}),0);
  } finally {
    await db.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    await db.territorySettings.update({where:{id:'revier'},data:{enabledAt:originalSettings.enabledAt}});
    await db.$disconnect();
  }
});
