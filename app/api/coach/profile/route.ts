import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { calculateAthleteBaseline } from "@/lib/training/baseline";
import { getTrainingPaces } from "@/lib/training/vdot";
import { calculateHeartRateZones, estimateMaxHeartRate } from "@/lib/training/zones";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch user profile from DB
  const profile = await db.userProfile.findUnique({
    where: { userId: user.id },
  });

  // 2. Calculate baseline from Strava historical activities
  const baseline = await calculateAthleteBaseline(user.id);

  const effectiveMaxHr =
    profile?.maxHeartrate || baseline.measuredMaxHr || estimateMaxHeartRate(30);
  const effectiveVdot =
    profile?.vdotScore && profile.vdotScore >= baseline.estimatedVdot
      ? profile.vdotScore
      : baseline.estimatedVdot;

  const paces = getTrainingPaces(effectiveVdot);
  const zones = calculateHeartRateZones(effectiveMaxHr, profile?.restingHeartrate ?? undefined);

  return NextResponse.json({
    profile,
    baseline,
    paces,
    zones,
    calculatedVdot: effectiveVdot,
    calculatedMaxHr: effectiveMaxHr,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      birthDate,
      heightCm,
      weightKg,
      restingHeartrate,
      maxHeartrate,
      vdotScore,
      weeklyAvailability,
      preferredLongRunDay,
      includeSundayRun,
      preferredTerrain,
      notes,
    } = body;

    const parsedLongRunDay =
      preferredLongRunDay === null || preferredLongRunDay === -1 || preferredLongRunDay === ""
        ? null
        : preferredLongRunDay !== undefined
        ? Number(preferredLongRunDay)
        : undefined;

    const updatedProfile = await db.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        birthDate: birthDate ? new Date(birthDate) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        restingHeartrate: restingHeartrate ? Number(restingHeartrate) : null,
        maxHeartrate: maxHeartrate ? Number(maxHeartrate) : null,
        vdotScore: vdotScore ? Number(vdotScore) : null,
        weeklyAvailability: weeklyAvailability ? Number(weeklyAvailability) : 3,
        preferredLongRunDay: parsedLongRunDay === undefined ? null : parsedLongRunDay,
        includeSundayRun: includeSundayRun !== undefined ? Boolean(includeSundayRun) : true,
        preferredTerrain: preferredTerrain || "ROAD",
        notes: notes || null,
      },
      update: {
        birthDate: birthDate ? new Date(birthDate) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        restingHeartrate: restingHeartrate ? Number(restingHeartrate) : undefined,
        maxHeartrate: maxHeartrate ? Number(maxHeartrate) : undefined,
        vdotScore: vdotScore !== undefined ? (vdotScore ? Number(vdotScore) : null) : undefined,
        weeklyAvailability: weeklyAvailability ? Number(weeklyAvailability) : undefined,
        preferredLongRunDay: parsedLongRunDay,
        includeSundayRun: includeSundayRun !== undefined ? Boolean(includeSundayRun) : undefined,
        preferredTerrain: preferredTerrain || undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern des Profils" },
      { status: 500 }
    );
  }
}
