import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

const DAILY_GENERATION_LIMIT = 5;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [plan, generationsToday] = await Promise.all([
    db.trainingPlan.findFirst({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "PROCESSING", "QUEUED"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: {
            workouts: {
              orderBy: { scheduledDate: "asc" },
            },
          },
        },
      },
    }),
    db.trainingPlan.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfDay },
      },
    }),
  ]);

  return NextResponse.json({
    plan,
    generationsToday,
    dailyLimit: DAILY_GENERATION_LIMIT,
    remainingToday: Math.max(0, DAILY_GENERATION_LIMIT - generationsToday),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const generationsToday = await db.trainingPlan.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfDay },
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
    const body = await req.json();
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

    // Archive or complete existing active plans
    await db.trainingPlan.updateMany({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "PROCESSING", "QUEUED"] },
      },
      data: { status: "ARCHIVED" },
    });

    // Create new plan record in QUEUED state
    const plan = await db.trainingPlan.create({
      data: {
        userId: user.id,
        title: title || `${goalType} Trainingsplan`,
        goalType,
        targetDistance: targetDistance ? Number(targetDistance) : null,
        targetTimeSeconds: targetTimeSeconds ? Number(targetTimeSeconds) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        generationPrompt: goalDescription || goalSubtype || null,
        startDate,
        endDate,
        status: "QUEUED",
        totalWeeks: 10,
      },
    });

    // Enqueue background processing in Inngest
    const parsedLongRunDay =
      preferredLongRunDay === null || preferredLongRunDay === -1 || preferredLongRunDay === ""
        ? null
        : Number(preferredLongRunDay);

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

    return NextResponse.json({
      success: true,
      planId: plan.id,
      status: "QUEUED",
    });
  } catch (error) {
    console.error("Error creating training plan:", error);
    return NextResponse.json(
      { error: "Fehler beim Anlegen des Trainingsplans" },
      { status: 500 }
    );
  }
}
