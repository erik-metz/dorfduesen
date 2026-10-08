import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await db.trainingPlan.findFirst({
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
  });

  return NextResponse.json({ plan });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
