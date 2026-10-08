import { InputError, readCoachBody } from '@/lib/training/validation';
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

import { DAILY_GENERATION_LIMIT, generationDay, reservePlan } from '@/lib/training/plan-requests';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [plan, latest, generationsToday] = await Promise.all([
    db.trainingPlan.findFirst({
      where: { userId: user.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' },
      include: { weeks: { orderBy: { weekNumber: 'asc' }, include: {
        workouts: { orderBy: { scheduledDate: 'asc' }, include: { matchedActivity: {
          select: { id: true, stravaId: true, name: true, distance: true, movingTime: true,
            averageSpeed: true, averageHeartrate: true, startDate: true },
        } } },
      } } },
    }),
    db.trainingPlan.findFirst({
      where: { userId: user.id, status: { in: ['ACTIVE', 'PROCESSING', 'QUEUED', 'FAILED'] } },
      orderBy: { createdAt: 'desc' }, select: { id: true, status: true },
    }),
    db.planGenerationAttempt.count({ where: { userId: user.id, createdAt: generationDay() } }),
  ]);
  return NextResponse.json({
    plan, generation: latest && latest.status !== 'ACTIVE' ? latest : null,
    generationsToday, dailyLimit: DAILY_GENERATION_LIMIT,
    remainingToday: Math.max(0, DAILY_GENERATION_LIMIT - generationsToday),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {

    const generationsToday = await db.planGenerationAttempt.count({
      where: {
        userId: user.id,
        createdAt: generationDay(),
      },
    });

    if (generationsToday >= DAILY_GENERATION_LIMIT) {
      return NextResponse.json(
        {
          error: `Tageslimit erreicht: Du hast heute bereits ${generationsToday} von ${DAILY_GENERATION_LIMIT} Trainingsplänen generiert. Bitte versuche es morgen wieder.`,
          generationsToday,
          dailyLimit: DAILY_GENERATION_LIMIT,
        },
        { status: 429 }
      );
    }
    const body = await readCoachBody(req, 'plan');
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
    } = body;

    if (!goalType) {
      return NextResponse.json({ error: "Zieltyp (goalType) ist erforderlich" }, { status: 400 });
    }

    const startDate = new Date();
    // Default 10 weeks if target date not specified
    const endDate = targetDate
      ? new Date(targetDate)
      : new Date(startDate.getTime() + 10 * 7 * 24 * 60 * 60 * 1000);

    const reservation = await reservePlan(user.id, {
      title: title || `${goalType} Trainingsplan`, goalType,
      targetDistance: targetDistance ? Number(targetDistance) : null,
      targetTimeSeconds: targetTimeSeconds ? Number(targetTimeSeconds) : null,
      targetDate: targetDate ? new Date(targetDate) : null,
      generationPrompt: goalDescription || goalSubtype || null,
      startDate, endDate, totalWeeks: 10,
    });
    if (reservation.kind === 'limit') return NextResponse.json({ error: 'Tageslimit erreicht', generationsToday: reservation.generationsToday }, { status: 429 });
    if (reservation.kind === 'pending') return NextResponse.json({ error: 'Ein Trainingsplan wird bereits erstellt.' }, { status: 409 });
    const plan = reservation.plan;

    // Enqueue background processing in Inngest
    const parsedLongRunDay =
      preferredLongRunDay === null || preferredLongRunDay === -1 || preferredLongRunDay === ""
        ? null
        : Number(preferredLongRunDay);

    try {
      await inngest.send({
        name: "coach/plan.requested",
        data: {
          userId: user.id,
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
        },
      });

    } catch (error) {
      await db.trainingPlan.updateMany({ where: { id: plan.id, status: 'QUEUED' }, data: { status: 'FAILED' } });
      throw error;
    }
    return NextResponse.json({
      success: true,
      planId: plan.id,
      status: "QUEUED",
    });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error creating training plan:", error);
    return NextResponse.json(
      { error: "Fehler beim Anlegen des Trainingsplans" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.trainingPlan.deleteMany({
      where: {
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error deleting training plan:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Trainingsplans" },
      { status: 500 }
    );
  }
}

