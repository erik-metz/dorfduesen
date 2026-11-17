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
  const service=loadTs('lib/territory/service.ts', {
    '@/lib/db':{db:{
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
      return {territories:[],events:[],results:[]};
    }},
  });
  row.sourceHash=service.sourceHash(activity);
  await assert.rejects(service.getTerritoryData('u'), error=>budget.isTerritoryBudgetError(error));
  await assert.rejects(service.getTerritoryData('u'), error=>budget.isTerritoryBudgetError(error));
  assert.equal(calculations,1);
  assert.equal(shapeReads,1);
  // Actual data changes may recover; unchanged refreshes must not spend CPU again.
  row.checkedAt=new Date(now.getTime()+1000);
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
