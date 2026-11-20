import { InputError, readCoachBody } from '@/lib/training/validation';
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestCoachPlan } from "@/lib/coach/request-plan";

import { generationDay } from '@/lib/training/plan-requests';
import { getCoachPlanData } from '@/lib/data/coach-plan';
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';

export const maxDuration = 15;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { gte: dayStart, lt: dayEnd } = generationDay();
  return NextResponse.json(await getCoachPlanData(user.id, dayStart, dayEnd));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {

    return await requestCoachPlan(user.id, await readCoachBody(req, 'plan'));
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
    invalidateCacheTags(cacheTags.userPlans(user.id));

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

