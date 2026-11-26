import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const budget = loadTs('lib/territory/budget.ts');
const engine = loadTs('lib/territory/engine.ts');
const shape = { type: 'Polygon', coordinates: [[[8,49],[8.005,49],[8.005,49.005],[8,49.005],[8,49]]] };

test('territory: an exhausted budget fails before any polygon work or partial result', () => {
  assert.throws(() => engine.replayClaims([{ id:'a', userId:'u', endedAt:new Date().toISOString(), geometry:shape }], { budgetMs:0 }),
    error => budget.isTerritoryBudgetError(error));
});

test('territory: repeated reads do not retry a projection that exceeded its budget', async () => {
  let calculations=0, shapeReads=0, fail=true;
  const now=new Date();
  const activity={ userId:'u', name:'Runde', stravaId:'123', summaryPolyline:'test', sportType:'Run', startDate:new Date(now.getTime()-600000), elapsedTime:300, distance:1500,
    user:{ id:'u', firstname:'Düse', lastname:null } };
  const row={ id:'claim', activityId:'run', sourceHash:'', rulesVersion:2, status:'VALID', reason:null, endedAt:new Date(now.getTime()-300000), checkedAt:now, activity };
  const store=new Map();
  const projectionCache={
    findUnique:async({where})=>store.get(where.seasonKey)??null,
    upsert:async({where,create,update})=>{const next={...(store.get(where.seasonKey)??create),...(store.has(where.seasonKey)?update:{})};store.set(where.seasonKey,next);return next;},
  };
  const service=loadTs('lib/territory/service.ts', {
    '@/lib/db':{db:{
      territoryProjectionCache:projectionCache,
      $transaction:async(fn)=>fn({$queryRaw:async()=>[],territoryProjectionCache:projectionCache,territoryClaim:{findMany:async args=>{shapeReads++;return [{id:row.id,geometry:shape,checkedAt:row.checkedAt}];}}}),
      territorySettings:{findUniqueOrThrow:async()=>({enabledAt:new Date(now.getUTCFullYear(),0,1)})},
      territoryClaim:{findMany:async args=>{
        if(args.select.geometry){shapeReads++;return [{id:row.id,geometry:shape,checkedAt:row.checkedAt}];}
        return [row];
      }},
      activity:{findMany:async()=>[]},
    }},
    './engine':{...engine,replayClaims:(_claims,options)=>{
      calculations++;
      assert.equal(options.budgetMs,budget.TERRITORY_REPLAY_BUDGET_MS);
      if(fail) throw new budget.TerritoryBudgetExceededError();
      return {version:engine.REPLAY_VERSION,cursor:null,territories:[],events:[],results:[]};
    }},
  });
  row.sourceHash=service.sourceHash(activity);
  await assert.rejects(service.getTerritoryData('u'), error=>budget.isTerritoryBudgetError(error));
  await assert.rejects(service.getTerritoryData('u'), error=>budget.isTerritoryBudgetError(error));
  assert.equal(calculations,1);
  assert.equal(shapeReads,1);
  // Actual data changes may recover; unchanged refreshes must not spend CPU again.
  row.endedAt=new Date(row.endedAt.getTime()+1000);
  fail=false;
  await service.getTerritoryData('u');
  await service.getTerritoryData('u');
  assert.equal(calculations,2);
  assert.equal(shapeReads,2);
});

test('territory API: budget errors produce 503 with a cooling-off period', async () => {
  const route=loadTs('app/api/arena/territories/route.ts', {
    '@/lib/auth/session':{getCurrentUser:async()=>({id:'u'})},
    '@/lib/territory/service':{getTerritoryData:async()=>{throw new budget.TerritoryBudgetExceededError();}},
    'next/server':{connection:async()=>{},NextResponse:{json:(body,init)=>Response.json(body,init)}},
  });
  const response=await route.GET();
  assert.equal(response.status,503);
  assert.equal(response.headers.get('retry-after'),String(budget.TERRITORY_RETRY_SECONDS));
  assert.equal(route.maxDuration,10);
});

test('territory: a later run is appended to the stored projection; an older one triggers one full replay', async () => {
  const now=new Date();
  const store=new Map(), calls=[];
  const rows=[];
  const makeRow=(id,user,minutesAgo,dx=0)=>{
    const startDate=new Date(now.getTime()-(minutesAgo+40)*60000);
    const activity={ userId:user, name:`Runde ${id}`, stravaId:id, summaryPolyline:id, sportType:'Run', startDate, elapsedTime:2400, distance:5000, user:{ id:user, firstname:user, lastname:null } };
    return { id:`claim-${id}`, activityId:id, sourceHash:'', rulesVersion:2, status:'VALID', reason:null, endedAt:new Date(now.getTime()-minutesAgo*60000), checkedAt:now, activity,
      geometry:{ type:'Polygon', coordinates:[[[8+dx,49],[8.005+dx,49],[8.005+dx,49.005],[8+dx,49.005],[8+dx,49]]] } };
  };
  const projectionCache={
    findUnique:async({where})=>store.get(where.seasonKey)??null,
    upsert:async({where,create,update})=>{const next={...(store.get(where.seasonKey)??create),...(store.has(where.seasonKey)?JSON.parse(JSON.stringify(update)):{})};store.set(where.seasonKey,next);return next;},
  };
  const territoryClaim={findMany:async args=>args.select.geometry
    ? rows.filter(r=>args.where.id.in.includes(r.id)).map(r=>({id:r.id,geometry:r.geometry,checkedAt:r.checkedAt}))
    : rows};
  const service=loadTs('lib/territory/service.ts', {
    '@/lib/db':{db:{
      territorySettings:{findUniqueOrThrow:async()=>({enabledAt:new Date(now.getUTCFullYear(),0,1)})},
      territoryProjectionCache:projectionCache, territoryClaim, activity:{findMany:async()=>[]},
      $transaction:async fn=>fn({$queryRaw:async()=>[],territoryProjectionCache:projectionCache,territoryClaim}),
    }},
    './engine':{...engine,replayClaims:(claims,options)=>{calls.push({ids:claims.map(c=>c.id).sort(),base:Boolean(options.base)});return engine.replayClaims(claims,options);}},
  });
  const add=row=>{row.sourceHash=service.sourceHash(row.activity);rows.push(row);};
  add(makeRow('a','alice',300));
  await service.getTerritoryData('alice');
  add(makeRow('b','bob',100,.02));
  const data=await service.getTerritoryData('alice');
  assert.equal(JSON.stringify(calls[1]),JSON.stringify({ids:['b'],base:true}));
  assert.equal(data.territories.length,2);
  add(makeRow('c','carol',200,.04));
  await service.getTerritoryData('alice');
  assert.equal(JSON.stringify(calls[2]),JSON.stringify({ids:['a','b','c'],base:false}));
});
