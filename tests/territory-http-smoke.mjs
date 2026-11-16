import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadTs } from './load-ts.mjs';

const base = process.env.TEST_BASE_URL;
const url = process.env.TEST_DATABASE_URL;
if (!base || !url || !['localhost','127.0.0.1'].includes(new URL(base).hostname) ||
  !['localhost','127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('Territory HTTP tests require explicit local TEST_BASE_URL and TEST_DATABASE_URL');
}
const db = new PrismaClient({ datasources:{ db:{url} } });
let user;
try {
  for (let i=0; ; i++) {
    try { await fetch(`${base}/api/auth/me`); break; }
    catch (error) { if (i===20) throw error; await new Promise(resolve=>setTimeout(resolve,500)); }
  }
  assert.equal((await fetch(`${base}/api/arena/territories`)).status,401);
  user=await db.user.create({data:{stravaAthleteId:`http-revier-${crypto.randomUUID()}`,firstname:'TestDüse'}});
  const { createSessionToken } = loadTs('lib/auth/session.ts', { 'next/headers':{}, '@/lib/db':{db} });
  const token=await createSessionToken({userId:user.id,stravaAthleteId:user.stravaAthleteId});
  const headers={cookie:`dorfduesen_session=${token}`};
  const initial=await fetch(`${base}/api/arena/territories`,{headers});
  assert.equal(initial.status,200);
  assert.ok(initial.headers.get('cache-control').includes('no-store'));
  const payload=await initial.json();
  const startDate=new Date(Math.max(Date.now()-2000,Date.parse(payload.season.start)));
  const endedAt=new Date(startDate.getTime()+1000);
  if (endedAt>new Date()) await new Promise(resolve=>setTimeout(resolve,endedAt.getTime()-Date.now()+10));
  // Seed a validated ledger entry; GPS validation is exercised in the database test.
  const activity=await db.activity.create({data:{userId:user.id,stravaId:`http-revier-${crypto.randomUUID()}`,name:'Revier-Runde',distance:1500,movingTime:1,elapsedTime:1,totalElevationGain:0,sportType:'Run',startDate,startDateLocal:startDate}});
  const { sourceHash }=loadTs('lib/territory/service.ts',{'@/lib/db':{db}});
  await db.territoryClaim.create({data:{activityId:activity.id,sourceHash:sourceHash(activity),rulesVersion:1,status:'VALID',endedAt,
    geometry:{type:'Polygon',coordinates:[[[8,49],[8.005,49],[8.005,49.005],[8,49.005],[8,49]]]}}});
  const owned=await (await fetch(`${base}/api/arena/territories`,{headers})).json();
  assert.ok(owned.myAreaM2>10000,JSON.stringify(owned));
  assert.ok(owned.territories.some(t=>t.mine && t.lastActivityName==='Revier-Runde' && t.history.length===1));
  assert.equal(owned.myRuns[0].status,'VALID');
  const bearer=randomBytes(32).toString('base64url');
  await db.mobileSession.create({data:{userId:user.id,tokenHash:createHash('sha256').update(bearer).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
  const nativeHeaders={authorization:`Bearer ${bearer}`};
  const native=await fetch(`${base}/api/arena/territories`,{headers:nativeHeaders});
  assert.equal(native.status,200);
  assert.equal((await native.json()).myAreaM2,owned.myAreaM2);
  const arena=await fetch(`${base}/api/mobile/arena`,{headers:nativeHeaders});
  assert.equal(arena.status,200);
  assert.equal((await arena.json()).territories.myAreaM2,owned.myAreaM2);
  await db.activity.delete({where:{id:activity.id}});
  assert.equal((await (await fetch(`${base}/api/arena/territories`,{headers})).json()).myAreaM2,0);
  console.log('Territory HTTP checks passed: protected route, ownership/history, cookie and mobile bearer sessions, mobile arena, deletion.');
} finally {
  if (user) await db.user.delete({where:{id:user.id}});
  await db.$disconnect();
}
