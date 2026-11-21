import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './load-ts.mjs';

const xaiModel = (id, created, input, output) => ({
  id, created, input_modalities: ['text'], output_modalities: ['text'],
  version: '1.0', prompt_text_token_price: input, completion_text_token_price: output,
});

test('new Grok versions are discovered without rewriting the selection rules', () => {
  const { readModel, chooseDefault, modelOptions } = loadTs('lib/coach/models.ts', {
    '@/lib/db': { db: {} },
    '@/lib/ai/xai': { xai: {} },
  });
  const old = readModel(xaiModel('grok-4.3', 100, 12500, 25000));
  const expensive = readModel(xaiModel('grok-5', 200, 20000, 60000));
  const affordable = readModel(xaiModel('grok-5.1', 300, 12500, 25000));
  assert.equal(chooseDefault([expensive, old]).id, 'grok-4.3');
  assert.equal(chooseDefault([affordable, old]).id, 'grok-5.1');
  assert.equal(modelOptions([old, expensive])[0].newest, true);
  assert.equal(modelOptions([old, expensive])[0].premium, true);
  assert.equal(readModel({ ...xaiModel('grok-6', 400, 0, 0), output_modalities: ['image'] }), null);
  assert.equal(readModel({ ...xaiModel('grok-6', 400, 0, 0), completion_text_token_price: undefined }), null);
});

test('a warm model catalog makes no provider calls', async () => {
  const row = await loadCatalog({
    read: () => ({ data: { models: [{ id: 'grok-5' }], checked: {}, updatedAt: Date.now() },
      nextRefresh: new Date(Date.now() + 60_000) }),
    call: () => { assert.fail('warm catalog should not request xAI'); },
  });
  assert.equal(row[0].id, 'grok-5');
});

test('catalog requests share a refresh lease, including when xAI is unavailable', async () => {
  const cached = [{ id: 'grok-4.3' }];
  let nextRefresh = new Date(0);
  let calls = 0;
  const models = await loadCatalog({
    read: () => ({ data: { models: cached, checked: {}, updatedAt: Date.now() }, nextRefresh }),
    write: ({ where, data }) => {
      if (where.nextRefresh.getTime() !== nextRefresh.getTime()) return { count: 0 };
      nextRefresh = data.nextRefresh;
      return { count: 1 };
    },
    call: () => { calls++; return new Response(null, { status: 503 }); },
    concurrent: true,
  });
  assert.equal(calls, 1);
  assert.ok(nextRefresh.getTime() >= Date.now() + 23 * 60 * 60_000);
  assert.equal(models[0].id, 'grok-4.3');
});

async function loadCatalog({ read, write, call, concurrent }) {
  const previousKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = 'test-catalog-key';
  try {
    const { getCoachModels } = loadTs('lib/coach/models.ts', {
      '@/lib/db': { db: { coachModelCatalog: { findUnique: async () => read(), updateMany: async args => write(args) } } },
      '@/lib/ai/xai': { xai: {} },
      fetch: call,
    });
    if (!concurrent) return await getCoachModels();
    const [a, b] = await Promise.all([getCoachModels(), getCoachModels()]);
    assert.equal(a[0].id, b[0].id);
    return a;
  } finally {
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
  }
}

test('Coach clients reuse persisted settings and share one daily refresh', async () => {
  const createCache = () => loadTs('apps/mobile/src/coach/settings-cache.ts');
  const storage = new Map();
  const adapter = { read: key => storage.get(key), write: (key, value) => storage.set(key, value) };
  const models = [{ id: 'grok-5', label: 'Grok 5', premium: false, newest: true }];
  const settings = { models, defaultModelId: models[0].id,
    quota: { messages: 40, premiumMessages: 10, plans: 3, resetsAt: new Date(Date.now() + 60_000).toISOString() } };
  const key = 'coach-settings-v1:test';
  const displayed = [];
  const show = (value, fresh) => displayed.push([value.defaultModelId, fresh]);
  let calls = 0;
  const fetchSettings = async () => { calls++; return settings; };

  const { refreshDailyCoachSettings } = createCache();
  const [next] = await Promise.all([
    refreshDailyCoachSettings(key, adapter, fetchSettings, show),
    refreshDailyCoachSettings(key, adapter, fetchSettings, show),
  ]);
  assert.equal(calls, 1);
  assert.ok(next > Date.now() + 23 * 60 * 60_000);

  await createCache().refreshDailyCoachSettings(key, adapter, fetchSettings, show);
  assert.equal(calls, 1, 'reopening the app respects the saved refresh time');
  assert.deepEqual(displayed.at(-1), ['grok-5', false]);

  storage.set(key, JSON.stringify({ attemptedAt: Date.now() - 25 * 60 * 60_000, settings }));
  const reread = createCache().refreshDailyCoachSettings;
  await reread(key, adapter, async () => { calls++; throw new Error('Offline'); }, show);
  await createCache().refreshDailyCoachSettings(key, adapter, fetchSettings, show);
  assert.equal(calls, 2, 'an unavailable server does not trigger a second attempt');
  assert.deepEqual(displayed.at(-1), ['grok-5', false]);
});

test('new daily quota does not inherit counters from the previous day', () => {
  const { currentCoachQuota, mergeCoachQuota } = loadTs('apps/mobile/src/coach/settings-cache.ts');
  const expired = { plans: 0, resetsAt: new Date(Date.now() - 1000).toISOString() };
  const next = { messages: 39, resetsAt: new Date(Date.now() + 60_000).toISOString() };
  assert.equal(currentCoachQuota(expired), undefined);
  assert.equal(mergeCoachQuota(expired, next).plans, undefined);
});
