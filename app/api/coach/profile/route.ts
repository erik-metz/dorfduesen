import { InputError, readCoachBody } from '@/lib/training/validation';
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { baselineFromActivities } from "@/lib/training/baseline-calculation";
import { calculateFitnessHistory } from "@/lib/training/history";
import { estimateVo2max } from "@/lib/training/vo2max";
import { getTrainingPaces } from "@/lib/training/vdot";
import { calculateHeartRateZones, estimateMaxHeartRate } from "@/lib/training/zones";
import { buildHealthOverview } from "@/lib/mobile/health-overview";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const healthFrom = new Date(now.getTime() - 182 * 86400000);
  const [profile, activities, metrics, healthRecords] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.activity.findMany({ where: { userId: user.id, startDate: { gte: new Date(now.getTime() - 38 * 7 * 86400000), lte: now } } }),
    db.healthMetric.findMany({ where: { userId: user.id, date: { lte: now } }, orderBy: { date: 'desc' } }),
    db.mobileHealthRecord.findMany({
      where: {
        userId: user.id,
        startAt: { gte: healthFrom, lte: now },
        recordType: { in: ['workout', 'vo2_max', 'resting_heart_rate', 'heart_rate_variability', 'body_mass', 'body_fat_percentage', 'oxygen_saturation', 'respiratory_rate', 'sleep', 'step_count', 'heart_rate'] },
      },
      select: { id: true, provider: true, recordId: true, recordType: true, startAt: true, endAt: true, value: true, sourceName: true, sourceId: true },
      orderBy: { startAt: 'desc' },
      take: 5000,
    }),
  ]);
  const baseline = baselineFromActivities(user.id, activities, profile, now);
  const history = calculateFitnessHistory(user.id, activities, metrics, now);

  const effectiveMaxHr =
    profile?.maxHeartrate || baseline.measuredMaxHr || estimateMaxHeartRate(30);
  const birthDate = profile?.birthDate;
  const age = birthDate ? now.getUTCFullYear() - birthDate.getUTCFullYear() - (now.getUTCMonth() < birthDate.getUTCMonth() || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate()) ? 1 : 0) : null;
  const validAge = age !== null && age >= 18 && age <= 100;
  const vo2maxHr = profile?.maxHeartrate ?? (validAge ? estimateMaxHeartRate(age) : 185);
  const vo2max = estimateVo2max(activities, now, vo2maxHr, profile?.maxHeartrate ? 'profile' : validAge ? 'age' : 'default', profile?.restingHeartrate);
  const effectiveVdot = profile?.vdotScore ?? baseline.estimatedVdot;

  const paces = getTrainingPaces(effectiveVdot);
  const zones = calculateHeartRateZones(effectiveMaxHr, profile?.restingHeartrate ?? undefined);
  const healthOverview = buildHealthOverview(healthRecords, activities, now);

  return NextResponse.json({
    profile,
    history,
    vo2max,
    baseline,
    paces,
    zones,
    calculatedVdot: effectiveVdot,
    calculatedMaxHr: effectiveMaxHr,
    healthOverview,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readCoachBody(req, 'profile');
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
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern des Profils" },
      { status: 500 }
    );
  }
}
