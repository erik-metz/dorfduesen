import { createHash } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCoachReply } from '@/lib/coach/chat';
import { planSelect, weekSelect } from '@/lib/coach/chat-data';
import { requestCoachPlan } from '@/lib/coach/request-plan';
import { isJsonObject } from '@/lib/mobile/health';
import { berlinMidnight, dayKey, shiftDay } from '@/lib/time';
import { chooseDefault, getCoachModels, isPremium, modelOptions } from '@/lib/coach/models';
import { CoachBudgetError } from '@/lib/coach/spend';
import { readCoachQuota } from '@/lib/coach/quota';
import { COACH_CHAT_DAILY_LIMIT, COACH_PREMIUM_DAILY_LIMIT, COACH_CONSENT_VERSION } from '@/apps/mobile/src/coach/contracts';
import { InputError, validateCoachBody } from '@/lib/training/validation';

const headers = { 'Cache-Control': 'private, no-store' };
const titleLength = 70;
const pageSize = 20;
const clientId = /^[a-f0-9-]{36}$/i;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

function planIdFor(turnId: string) {
  return `coach-${turnId}`;
}

export async function coachGet(request: Request, userId: string | undefined) {
  if (!userId) return json({ error: 'Bitte melde dich erneut an.' }, 401);
  const { searchParams } = new URL(request.url);
  if (searchParams.has('settings')) {
    const [models, quota] = await Promise.all([getCoachModels(), readCoachQuota(userId)]);
    return json({ models: modelOptions(models), defaultModelId: chooseDefault(models)?.id ?? null, quota });
  }
  const planId = searchParams.get('plan');
  if (planId) {
    const weekNumber = Number(searchParams.get('week') ?? 1);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 26) return json({ error: 'Ungültige Trainingswoche.' }, 400);
    const plan = await db.trainingPlan.findFirst({ where: { id: planId, userId }, select: planSelect });
    if (!plan) return json({ error: 'Plan nicht gefunden.' }, 404);
    if (searchParams.get('status') === '1') return json({ plan });
    const week = await db.planWeek.findFirst({ where: { planId, weekNumber }, select: weekSelect });
    return json({ plan, week });
  }

  const conversationId = searchParams.get('conversation');
  if (!conversationId) {
    const before = searchParams.get('before');
    const cursor = before ? await db.coachConversation.findFirst({ where: { userId, id: before } }) : null;
    const conversations = await db.coachConversation.findMany({
      where: { userId, ...(cursor ? { OR: [
        { updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
      ] } : {}) },
      select: { id: true, title: true, updatedAt: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: pageSize + 1,
    });
    return json({ conversations: conversations.slice(0, pageSize), hasMore: conversations.length > pageSize });
  }

  const conversation = await db.coachConversation.findFirst({ where: { id: conversationId, userId } });
  if (!conversation) return json({ error: 'Gespräch nicht gefunden.' }, 404);
  const before = searchParams.get('before');
  const cursor = before ? await db.coachTurn.findFirst({ where: { id: before, conversationId } }) : null;
  const turns = await db.coachTurn.findMany({
    where: { conversationId, ...(cursor ? { OR: [
      { createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ] } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pageSize + 1,
  });
  const page = turns.slice(0, pageSize);
  const plans = await db.trainingPlan.findMany({
    where: { userId, id: { in: page.filter(turn => turn.proposal).map(turn => planIdFor(turn.id)) } },
    select: planSelect,
  });
  return json({
    conversation, hasMore: turns.length > pageSize,
    turns: page.reverse().map(turn => ({
      ...turn,
      status: turn.status === 'PENDING' && Date.now() - turn.createdAt.getTime() > 55000 ? 'FAILED' : turn.status,
      plan: plans.find(plan => plan.id === planIdFor(turn.id)),
    })),
  });
}

export async function coachDelete(request: Request, userId: string | undefined) {
  if (!userId) return json({ error: 'Bitte melde dich erneut an.' }, 401);
  const id = new URL(request.url).searchParams.get('conversation');
  if (!id) return json({ error: 'Gespräch fehlt.' }, 400);
  await db.coachConversation.deleteMany({ where: { id, userId } });
  return json({ deleted: true });
}

export async function coachPost(request: Request, userId: string | undefined) {
  if (!userId) return json({ error: 'Bitte melde dich erneut an.' }, 401);
  const raw = await request.text();
  if (raw.length > 10000) return json({ error: 'Nachricht ist zu lang.' }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) throw new Error('Expected object');
    body = parsed;
  } catch { return json({ error: 'Ungültige Anfrage.' }, 400); }

  if (body.action === 'confirm' && typeof body.turnId === 'string') {
    try {
      const turn = await db.coachTurn.findFirst({
        where: { id: body.turnId, conversation: { userId }, status: 'COMPLETE' },
        select: { id: true, proposal: true },
      });
      if (!turn?.proposal) return json({ error: 'Planvorschlag nicht gefunden.' }, 404);
      const planId = planIdFor(turn.id);
      const existing = await db.trainingPlan.findFirst({ where: { id: planId, userId }, select: { id: true, status: true } });
      if (existing) return json({ success: true, planId: existing.id, status: existing.status });
      const response = await requestCoachPlan(userId, validateCoachBody(turn.proposal, 'plan'), planId);
      if (!response.ok && response.status !== 429) return response;
      return json({ ...await response.json(), quota: await readCoachQuota(userId) }, response.status);
    } catch (error) {
      if (error instanceof InputError) return json({ error: error.message }, 400);
      console.error('Coach plan request failed');
      return json({ error: 'Planauftrag konnte nicht gestartet werden.' }, 500);
    }
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
  if (!question || question.length > 3000 || typeof body.requestId !== 'string' || !clientId.test(body.requestId)) {
    return json({ error: 'Gib eine Nachricht mit höchstens 3.000 Zeichen ein.' }, 400);
  }
  if (body.consent !== COACH_CONSENT_VERSION) return json({ error: 'Bitte bestätige die Datennutzung für den KI-Chat.' }, 400);
  if (!process.env.XAI_API_KEY) return json({ error: 'Der KI-Coach ist noch nicht eingerichtet.' }, 503);

  const deadline = AbortSignal.timeout(44000);
  const turnId = createHash('sha256').update(`${userId}:${body.requestId}`).digest('hex');
  const turnWhere = { id: turnId, conversation: { userId } };
  const existing = await db.coachTurn.findFirst({ where: turnWhere });
  if (existing) return json({ turn: existing });

  const models = await getCoachModels();
  const standard = chooseDefault(models);
  if (!standard) return json({ error: 'Die KI-Modelle sind gerade nicht verfügbar. Bitte versuche es später erneut.' }, 503);
  const model = body.modelId == null ? standard : models.find(item => item.id === body.modelId);
  if (!model) return json({ error: 'Dieses Modell ist nicht mehr verfügbar. Wähle ein anderes Modell oder nutze „Automatisch · sparsam“.' }, 422);
  const premium = isPremium(model, standard);

  const reservation = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const previous = await tx.coachTurn.findFirst({ where: turnWhere });
    if (previous) return { kind: 'existing' as const, turn: previous };
    const day = dayKey();
    const quota = await tx.coachChatQuota.findUnique({ where: { userId } });
    const count = quota?.day === day ? quota.count : 0;
    const premiumCount = quota?.day === day ? quota.premiumCount : 0;
    if (count >= COACH_CHAT_DAILY_LIMIT) return { kind: 'limit' as const };
    if (premium && premiumCount >= COACH_PREMIUM_DAILY_LIMIT) return { kind: 'premiumLimit' as const };
    const pending = await tx.coachTurn.findFirst({
      where: { conversation: { userId }, status: 'PENDING', createdAt: { gt: new Date(Date.now() - 55000) } },
      select: { id: true },
    });
    if (pending) return { kind: 'busy' as const };
    const conversation = conversationId
      ? await tx.coachConversation.findFirst({ where: { id: conversationId, userId } })
      : await tx.coachConversation.create({ data: { userId, title: question.slice(0, titleLength) } });
    if (!conversation) return { kind: 'missing' as const };
    const history = await tx.coachTurn.findMany({
      where: { conversationId: conversation.id, status: 'COMPLETE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8,
      select: { question: true, answer: true, proposal: true },
    });
    await tx.coachConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    await tx.coachChatQuota.upsert({
      where: { userId }, create: { userId, day, count: 1, premiumCount: Number(premium) },
      update: { day, count: count + 1, premiumCount: premiumCount + Number(premium) },
    });
    const turn = await tx.coachTurn.create({ data: { id: turnId, conversationId: conversation.id, question } });
    return { kind: 'created' as const, turn, conversation, history: history.reverse(), quota: {
      messages: COACH_CHAT_DAILY_LIMIT - count - 1,
      premiumMessages: COACH_PREMIUM_DAILY_LIMIT - premiumCount - Number(premium),
      resetsAt: berlinMidnight(shiftDay(day, 1)).toISOString(),
    } };
  });

  if (reservation.kind === 'existing') return json({ turn: reservation.turn });
  if (reservation.kind === 'missing') return json({ error: 'Gespräch nicht gefunden.' }, 404);
  if (reservation.kind === 'limit' || reservation.kind === 'premiumLimit') {
    const error = reservation.kind === 'limit' ? 'Tageslimit für Coach-Nachrichten erreicht.'
      : 'Tageslimit für teurere Modelle erreicht. Mit „Automatisch · sparsam“ kannst du weiterchatten.';
    return json({ error, quota: await readCoachQuota(userId) }, 429);
  }
  if (reservation.kind === 'busy') return json({ error: 'Der Coach beantwortet gerade noch eine Nachricht.' }, 409);

  const encoder = new TextEncoder();
  let publish: (event: unknown) => void = () => {};
  let finish: () => void = () => {};
  const stream = new ReadableStream({
    start(controller) {
      publish = event => { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      finish = () => controller.close();
    },
    cancel() { publish = () => {}; finish = () => {}; },
  });
  publish({ conversation: reservation.conversation, turn: reservation.turn, quota: reservation.quota });

  // Drain a disconnected stream without cancelling persistence.
  const task = (async () => {
    try {
      const reply = await generateCoachReply(reservation.history, question, userId, model, deadline, text => publish({ text }));
      const saved = await db.coachTurn.updateMany({ where: { id: turnId }, data: { ...reply, status: 'COMPLETE' } });
      if (saved.count) publish({ turn: { ...reservation.turn, ...reply, status: 'COMPLETE' } });
    } catch (error) {
      await db.coachTurn.updateMany({ where: { id: turnId }, data: { status: 'FAILED' } }).catch(() => {});
      publish({ turn: { ...reservation.turn, status: 'FAILED' }, error: error instanceof CoachBudgetError ? error.message : 'Der Coach konnte gerade nicht antworten.' });
    } finally {
      finish();
    }
  })();
  after(() => task);

  return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' } });
}
