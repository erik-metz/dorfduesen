import type { ReasoningEffort } from 'openai/resources/shared';
import { xai } from '@/lib/ai/xai';
import { db } from '@/lib/db';
import { estimateCoachCost, reserveCoachSpend, type ModelPrices } from '@/lib/coach/spend';

export type CoachModel = ModelPrices & {
  id: string;
  aliases: string[];
  label: string;
  version: string;
  created: number;
  effort?: NonNullable<ReasoningEffort>;
};
type Catalog = { models: CoachModel[]; checked: Record<string, string>; updatedAt: number };
type XaiModel = {
  id?: unknown; aliases?: unknown; created?: unknown; version?: unknown;
  input_modalities?: unknown; output_modalities?: unknown;
  prompt_text_token_price?: unknown; completion_text_token_price?: unknown;
  prompt_text_token_price_long_context?: unknown; completion_text_token_price_long_context?: unknown;
  capabilities?: { reasoning_effort?: string[] };
};

const cacheId = 1;
const freshness = 6 * 60 * 60 * 1000;
const retryDelay = 60 * 60 * 1000;
const maxStaleAge = 24 * 60 * 60 * 1000;

function price(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readModel(row: XaiModel): CoachModel | null {
  if (typeof row.id !== 'string' || !/^grok-\d[\w.-]*$/i.test(row.id)) return null;
  if (/\b(?:multi-agent|experimental|preview|beta)\b/i.test(row.id)) return null;
  if (!Array.isArray(row.input_modalities) || !row.input_modalities.includes('text') ||
      !Array.isArray(row.output_modalities) || !row.output_modalities.includes('text')) return null;
  const input = price(row.prompt_text_token_price);
  const output = price(row.completion_text_token_price);
  if (input === null || output === null) return null;
  const efforts = Array.isArray(row.capabilities?.reasoning_effort) ? row.capabilities.reasoning_effort : [];
  const effort = (['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const)
    .find(option => efforts.includes(option));
  return {
    id: row.id,
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
    label: row.id.replace(/^grok-/, 'Grok ').replaceAll('-', ' '),
    version: typeof row.version === 'string' ? row.version : '',
    created: typeof row.created === 'number' ? row.created : 0,
    input, output, effort,
    longInput: price(row.prompt_text_token_price_long_context) ?? 0,
    longOutput: price(row.completion_text_token_price_long_context) ?? 0,
  };
}

const newestFirst = (a: CoachModel, b: CoachModel) =>
  b.created - a.created || b.id.localeCompare(a.id, 'en', { numeric: true });
export const typicalCost = (model: CoachModel) => model.input * 4000 + model.output * 800;

export function chooseDefault(models: CoachModel[]) {
  return [...models].sort((a, b) => typicalCost(a) - typicalCost(b) || newestFirst(a, b))[0];
}

export function isPremium(model: CoachModel, standard: CoachModel) {
  return typicalCost(model) > typicalCost(standard);
}

export function modelOptions(models: CoachModel[]) {
  const sorted = [...models].sort(newestFirst);
  const standard = chooseDefault(sorted);
  return sorted.map((model, index) => ({
    id: model.id, label: model.label, newest: index === 0, premium: Boolean(standard && isPremium(model, standard)),
  }));
}

async function probe(model: CoachModel) {
  // The catalog has no function-calling flag. Validate the actual streaming
  // Responses endpoint with a tiny synthetic prompt and no user data.
  const tool = { type: 'function' as const, name: 'check', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, strict: false };
  const input = 'Call the check function now.';
  const max_output_tokens = 512;
  const settle = await reserveCoachSpend(estimateCoachCost(model, { input, tool }, max_output_tokens));
  try {
    const stream = await xai.responses.create({
      model: model.id, input, store: false, stream: true, max_output_tokens,
      ...(model.effort ? { reasoning: { effort: model.effort } } : {}),
      tools: [tool], tool_choice: 'required', parallel_tool_calls: false,
    }, { timeout: 11000, signal: AbortSignal.timeout(11000), maxRetries: 0 });
    for await (const event of stream) {
      if (event.type !== 'response.completed' && event.type !== 'response.incomplete' && event.type !== 'response.failed') continue;
      await settle(event.response.usage);
      if (event.type !== 'response.completed') throw new Error('Incomplete xAI compatibility check');
      return event.response.output.some(item => item.type === 'function_call' && item.name === 'check');
    }
  } catch (error) {
    const status = (error as { status?: unknown })?.status;
    if (status === 400 || status === 404 || status === 422) {
      await settle({ cost_in_usd_ticks: 0 });
      return false;
    }
    throw error;
  }
  throw new Error('Incomplete xAI compatibility check');
}

export async function getCoachModels(): Promise<CoachModel[]> {
  if (!process.env.XAI_API_KEY) return [];
  const now = Date.now();
  const saved = await db.coachModelCatalog.findUnique({ where: { id: cacheId } }) ?? await db.coachModelCatalog.upsert({
    where: { id: cacheId }, create: { id: cacheId, nextRefresh: new Date(0) }, update: {},
  });
  const previous = saved.data as Catalog | null;
  const cached = previous && now - previous.updatedAt <= maxStaleAge ? previous.models : [];
  if (saved.nextRefresh.getTime() > now) return cached;
  const lease = new Date(now + 20000);
  const held = await db.coachModelCatalog.updateMany({
    where: { id: cacheId, nextRefresh: saved.nextRefresh }, data: { nextRefresh: lease },
  });
  if (!held.count) return cached;

  try {
    const response = await fetch('https://api.x.ai/v1/language-models', {
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      signal: AbortSignal.timeout(3500), cache: 'no-store',
    });
    if (!response.ok) throw new Error('xAI catalog request failed');
    const { models: rows } = await response.json() as { models?: XaiModel[] };
    if (!Array.isArray(rows)) throw new Error('Invalid xAI catalog');
    const models = rows.map(readModel).filter((row): row is CoachModel => row !== null).sort(newestFirst);
    const checked = Object.fromEntries(models.flatMap(model => {
      const result = previous?.checked[model.id];
      return result === `yes:${model.version}` || result === `no:${model.version}` ? [[model.id, result]] : [];
    }));
    const unknown = models.filter(model => !checked[model.id]);
    const cheapest = chooseDefault(unknown);
    const candidates = [...new Set([...(cheapest ? [cheapest] : []), ...unknown])].slice(0, 4);
    await Promise.allSettled(candidates.map(async model => {
      checked[model.id] = `${await probe(model) ? 'yes' : 'no'}:${model.version}`;
    }));
    const available = models.filter(model => checked[model.id] === `yes:${model.version}`);
    const hasUnchecked = models.some(model => !checked[model.id]);
    const result = await db.coachModelCatalog.updateMany({
      where: { id: cacheId, nextRefresh: lease },
      data: { data: { models: available, checked, updatedAt: now }, nextRefresh: new Date(now + (hasUnchecked ? retryDelay : freshness)) },
    });
    return result.count ? available : cached;
  } catch {
    await db.coachModelCatalog.updateMany({ where: { id: cacheId, nextRefresh: lease }, data: { nextRefresh: new Date(now + retryDelay) } });
    return cached;
  }
}
