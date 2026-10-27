import { InputError, readCoachBody } from '@/lib/training/validation';
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cacheTags, invalidateCacheTags } from '@/lib/cache-tags';
import { getCoachMetrics } from '@/lib/data/coach-profile';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await getCoachMetrics(user.id);

  return NextResponse.json({ metrics });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readCoachBody(req, 'metric');
    const { weightKg, restingHeartrate, notes, date } = body;

    const entryDate = date ? new Date(date) : new Date();

    const createdMetric = await db.healthMetric.create({
      data: {
        userId: user.id,
        date: entryDate,
        weightKg: weightKg ? Number(weightKg) : null,
        restingHeartrate: restingHeartrate ? Number(restingHeartrate) : null,
        notes: notes || null,
      },
    });

    // Keep UserProfile in sync with latest entry
    await db.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        weightKg: weightKg ? Number(weightKg) : null,
        restingHeartrate: restingHeartrate ? Number(restingHeartrate) : null,
      },
      update: {
        ...(weightKg ? { weightKg: Number(weightKg) } : {}),
        ...(restingHeartrate ? { restingHeartrate: Number(restingHeartrate) } : {}),
      },
    });

    invalidateCacheTags(cacheTags.userHealth(user.id), cacheTags.userProfile(user.id));

    return NextResponse.json({ success: true, metric: createdMetric });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error creating health metric:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Körperdaten" },
      { status: 500 }
    );
  }
}
