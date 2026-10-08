import { inngest } from "../client";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { calculateAthleteBaseline } from "../../training/baseline";
import { buildPeriodizationSkeleton, PeriodizationPlanSkeleton } from "../../training/periodization";
import { getTrainingPaces } from "../../training/vdot";
import { calculateHeartRateZones } from "../../training/zones";
import { generatePlanWithGrok, GeneratedWeek } from "../../ai/generator";

export const generatePlanFunction = inngest.createFunction(
  {
    id: "generate-training-plan",
    name: "Generate Personalized Training Plan",
    triggers: [{ event: "coach/plan.requested" }],
    retries: 2,
    concurrency: { limit: 1, key: 'event.data.userId' },
    onFailure: async ({ event }) => {
      await db.trainingPlan.updateMany({
        where: { id: event.data.event.data.planId, status: { in: ['QUEUED', 'PROCESSING'] } },
        data: { status: 'FAILED' },
      });
    },
  },
  async ({ event, step }) => {
    const {
      userId,
      planId,
      goalType,
      goalSubtype,
      goalDescription,
      targetDistance,
      targetDate,
      weeklyAvailability,
      preferredLongRunDay,
      includeSundayRun,
    } = event.data;

    const requestedPlan = await db.trainingPlan.findFirst({ where: { id: planId, userId, status: { in: ['QUEUED', 'PROCESSING'] } } });
    if (!requestedPlan) return { success: false, reason: 'Request no longer pending' };

    // STEP 1: Calculate historical Strava baseline (CPU)
    const baseline = await step.run("calculate-athlete-baseline", async () => {
      // Mark plan as PROCESSING
      await db.trainingPlan.update({
        where: { id: planId },
        data: { status: "PROCESSING" },
      });

      const stats = await calculateAthleteBaseline(userId);

      // Fetch or update user profile with latest VDOT & HR
      const profile = await db.userProfile.findUnique({
        where: { userId },
      });

      const maxHr = profile?.maxHeartrate || stats.measuredMaxHr || 185;
      const restingHr = profile?.restingHeartrate;
      const vdot = profile?.vdotScore && profile.vdotScore >= stats.estimatedVdot
        ? profile.vdotScore
        : stats.estimatedVdot;

      await db.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          maxHeartrate: maxHr,
          restingHeartrate: restingHr,
          vdotScore: vdot,
          weeklyAvailability: weeklyAvailability || 3,
          preferredLongRunDay: preferredLongRunDay !== undefined ? preferredLongRunDay : null,
          includeSundayRun: includeSundayRun !== undefined ? Boolean(includeSundayRun) : true,
        },
        update: {
          maxHeartrate: maxHr,
          vdotScore: vdot,
          weeklyAvailability: weeklyAvailability || 3,
          preferredLongRunDay: preferredLongRunDay !== undefined ? preferredLongRunDay : null,
          includeSundayRun: includeSundayRun !== undefined ? Boolean(includeSundayRun) : true,
        },
      });

      return { stats, maxHr, restingHr, vdot };
    });

    // STEP 2: Compute periodization framework (CPU)
    const skeleton = await step.run("build-periodization-skeleton", async () => {
      return buildPeriodizationSkeleton({
        baseline: baseline.stats,
        goalType,
        goalSubtype,
        goalDescription,
        targetDistanceKm: targetDistance,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        weeklyAvailability,
        preferredLongRunDay,
        includeSundayRun: includeSundayRun !== undefined ? Boolean(includeSundayRun) : true,
      });
    });

    // STEP 3: Generate detailed workouts via xAI Grok (LLM / Fallback)
    const generatedWeeks: GeneratedWeek[] = await step.run("generate-workouts-with-xai", async () => {
      const paces = getTrainingPaces(baseline.vdot);
      const zones = calculateHeartRateZones(baseline.maxHr, baseline.restingHr ?? undefined);

      const planRecord = await db.trainingPlan.findUnique({
        where: { id: planId },
        select: { title: true },
      });

      return await generatePlanWithGrok({
        planTitle: planRecord?.title || `${goalType} Trainingsplan`,
        goalType,
        goalSubtype,
        goalDescription,
        athleteBaseline: baseline.stats,
        paces,
        zones,
        skeleton: skeleton as unknown as PeriodizationPlanSkeleton,
      });
    });

    // Persist the replacement and activation as one atomic operation.
    await step.run("save-plan-to-db", async () => {
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        const current = await tx.trainingPlan.findFirst({ where: { id: planId, userId, status: 'PROCESSING' } });
        if (!current) return;
        await tx.planWeek.deleteMany({ where: { planId } });
        for (const week of generatedWeeks) {
          await tx.planWeek.create({
            data: {
              planId, weekNumber: week.weekNumber, phase: week.phase,
              targetDistance: week.targetDistance, isDeloadWeek: week.isDeloadWeek,
              focusTitle: week.focusTitle,
              workouts: { create: week.workouts.map(wo => ({
                scheduledDate: new Date(wo.date), sportType: wo.sportType || 'Run',
                workoutType: wo.workoutType, title: wo.title, description: wo.description,
                targetDistance: wo.targetDistance, targetDurationMinutes: wo.targetDurationMinutes,
                targetPaceMin: wo.targetPaceMin, targetPaceMax: wo.targetPaceMax,
                targetHrZone: wo.targetHrZone,
                structuredSteps: (wo.structuredSteps as Prisma.InputJsonValue) ?? undefined,
                isFlexible: wo.isFlexible ?? true, recommendedTiming: wo.recommendedTiming || null,
                status: 'PENDING',
              })) },
            },
          });
        }
        await tx.trainingPlan.updateMany({
          where: { userId, id: { not: planId }, status: 'ACTIVE' }, data: { status: 'PAUSED' },
        });
        await tx.trainingPlan.update({
          where: { id: planId },
          data: { status: 'ACTIVE', totalWeeks: skeleton.totalWeeks,
            startDate: new Date(skeleton.startDate), endDate: new Date(skeleton.targetDate) },
        });
      }, { timeout: 30000 });
    });

    return {
      success: true,
      planId,
      totalWeeks: skeleton.totalWeeks,
    };
  }
);
