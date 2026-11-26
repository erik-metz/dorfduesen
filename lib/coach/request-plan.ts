import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { reservePlan } from '@/lib/training/plan-requests';
import type { CoachBody } from '@/lib/training/validation';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

export async function requestCoachPlan(userId: string, body: CoachBody, requestId?: string) {
  const {
    title,
    goalType,
    goalSubtype,
    goalDescription,
    targetDistance,
    targetTimeSeconds,
    targetDate,
    weeklyAvailability = 3,
    preferredLongRunDay = null,
    includeSundayRun = true,
    currentRunMinutes,
  } = body;

  if (!goalType) {
    return NextResponse.json({ error: "Zieltyp (goalType) ist erforderlich" }, { status: 400 });
  }

  const startDate = new Date();
  // Default 10 weeks if target date not specified
  const endDate = targetDate
    ? new Date(targetDate)
    : new Date(startDate.getTime() + 10 * 7 * 24 * 60 * 60 * 1000);

  const reservation = await reservePlan(userId, {
    title: title || `${goalType} Trainingsplan`, goalType,
    targetDistance: targetDistance ? Number(targetDistance) : null,
    targetTimeSeconds: targetTimeSeconds ? Number(targetTimeSeconds) : null,
    targetDate: targetDate ? new Date(targetDate) : null,
    generationPrompt: goalDescription || goalSubtype || null,
    startDate, endDate, totalWeeks: 10,
  }, requestId);
  if (reservation.kind === 'existing') return NextResponse.json({ success: true, planId: reservation.plan.id, status: reservation.plan.status });
  if (reservation.kind === 'removed') return NextResponse.json({ error: 'Dieser Plan wurde gelöscht.' }, { status: 409 });
  if (reservation.kind === 'limit') return NextResponse.json({ error: 'Tageslimit erreicht', generationsToday: reservation.generationsToday }, { status: 429 });
  if (reservation.kind === 'pending') return NextResponse.json({ error: 'Ein Trainingsplan wird bereits erstellt.' }, { status: 409 });
  const plan = reservation.plan;
  invalidateCacheTags(cacheTags.userPlans(userId));

  // Enqueue background processing in Inngest
  const parsedLongRunDay =
    preferredLongRunDay === null || preferredLongRunDay === -1 || preferredLongRunDay === ""
      ? null
      : Number(preferredLongRunDay);

  try {
    await inngest.send({
      name: "coach/plan.requested",
      data: {
        userId: userId,
        planId: plan.id,
        goalType,
        goalSubtype: goalSubtype || undefined,
        goalDescription: goalDescription || undefined,
        targetDistance: targetDistance ? Number(targetDistance) : undefined,
        targetTimeSeconds: targetTimeSeconds ? Number(targetTimeSeconds) : undefined,
        targetDate: targetDate ? targetDate : undefined,
        weeklyAvailability: Number(weeklyAvailability),
        preferredLongRunDay: parsedLongRunDay,
        includeSundayRun: Boolean(includeSundayRun),
        currentRunMinutes: currentRunMinutes === undefined || currentRunMinutes === null || currentRunMinutes === '' ? undefined : Number(currentRunMinutes),
      },
    });

  } catch (error) {
    await db.trainingPlan.updateMany({ where: { id: plan.id, status: 'QUEUED' }, data: { status: 'FAILED' } });
    invalidateCacheTags(cacheTags.userPlans(userId));
    throw error;
  }
  return NextResponse.json({
    success: true,
    planId: plan.id,
    status: "QUEUED",
  });
}
