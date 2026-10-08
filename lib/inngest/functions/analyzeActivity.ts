import { inngest } from "../client";
import { db } from "@/lib/db";
import { xai, XAI_DEFAULT_MODEL } from "../../ai/xai";

export const analyzeActivityFunction = inngest.createFunction(
  {
    id: "analyze-activity-compliance",
    name: "Analyze Activity & Match Training Plan",
    triggers: [{ event: "strava/activity.synced" }],
  },
  async ({ event, step }) => {
    const { activityId, userId } = event.data;

    // STEP 1: Find activity and check if user has active plan
    const match = await step.run("find-matching-workout", async () => {
      const activity = await db.activity.findUnique({
        where: { id: activityId },
      });

      if (!activity || !activity.sportType.toLowerCase().includes("run")) {
        return { matched: false, reason: "Not a run or not found" };
      }

      // Check active plan
      const activePlan = await db.trainingPlan.findFirst({
        where: {
          userId,
          status: "ACTIVE",
        },
        include: {
          weeks: {
            include: {
              workouts: true,
            },
          },
        },
      });

      if (!activePlan) {
        return { matched: false, reason: "No active plan found" };
      }

      // Smart Flexible Matching within the activity's week
      const activityDate = new Date(activity.startDate);
      const activityKm = activity.distance / 1000;

      // Strict Date Check: Activity MUST NOT be before the training plan start date (minus 1 day grace period)
      const planStart = new Date(activePlan.startDate);
      const planStartWithGrace = new Date(planStart.getTime() - 24 * 3600 * 1000);
      if (activityDate < planStartWithGrace) {
        return { matched: false, reason: "Activity is older than the active training plan start date" };
      }

      // Find the corresponding plan week (within +/- 1 day buffer around scheduled dates)
      let activeWeek = null;
      for (const week of activePlan.weeks) {
        if (week.workouts.length > 0) {
          const firstWo = new Date(week.workouts[0].scheduledDate);
          const lastWo = new Date(week.workouts[week.workouts.length - 1].scheduledDate);
          // 1 day buffer around week start/end
          const weekStart = new Date(firstWo.getTime() - 24 * 3600 * 1000);
          const weekEnd = new Date(lastWo.getTime() + 24 * 3600 * 1000);
          if (activityDate >= weekStart && activityDate <= weekEnd) {
            activeWeek = week;
            break;
          }
        }
      }

      // If week not found within date window, do NOT fall back to arbitrary future weeks!
      if (!activeWeek) {
        return { matched: false, reason: "Activity date does not match any scheduled week of the training plan" };
      }

      const pendingWorkouts = (activeWeek.workouts || []).filter((wo) => wo.status === "PENDING");
      if (pendingWorkouts.length === 0) {
        return { matched: false, reason: "No pending workouts in this week" };
      }

      let matchedWorkout = null;

      // 1. Long Run matching: If activity distance is >= 70% of planned Long Run
      const pendingLongRun = pendingWorkouts.find((wo) => wo.workoutType === "LONGRUN");
      if (pendingLongRun && pendingLongRun.targetDistance && activityKm >= pendingLongRun.targetDistance * 0.7) {
        matchedWorkout = pendingLongRun;
      }

      // 2. Exact same day matching
      if (!matchedWorkout) {
        const startOfDay = new Date(activityDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(activityDate);
        endOfDay.setHours(23, 59, 59, 999);

        matchedWorkout = pendingWorkouts.find((wo) => {
          const woDate = new Date(wo.scheduledDate);
          return woDate >= startOfDay && woDate <= endOfDay;
        });
      }

      // 3. Distance proximity matching
      if (!matchedWorkout) {
        matchedWorkout = [...pendingWorkouts].sort((a, b) => {
          const diffA = Math.abs((a.targetDistance || 5) - activityKm);
          const diffB = Math.abs((b.targetDistance || 5) - activityKm);
          return diffA - diffB;
        })[0];
      }

      if (!matchedWorkout) {
        return { matched: false, reason: "Could not find a matching workout" };
      }

      return {
        matched: true,
        workoutId: matchedWorkout.id,
        workoutTitle: matchedWorkout.title,
        targetDistance: matchedWorkout.targetDistance,
        targetPaceMin: matchedWorkout.targetPaceMin,
        targetHrZone: matchedWorkout.targetHrZone,
        activityDistanceKm: Math.round((activity.distance / 1000) * 10) / 10,
        activityAvgHr: activity.averageHeartrate,
        activityPaceMinPerKm: activity.averageSpeed ? Math.round((1000 / activity.averageSpeed) / 60 * 10) / 10 : null,
      };
    });

interface WorkoutMatchResult {
  matched: boolean;
  reason?: string;
  workoutId?: string;
  workoutTitle?: string;
  targetDistance?: number | null;
  targetPaceMin?: string | null;
  targetHrZone?: number | null;
  activityDistanceKm?: number;
  activityAvgHr?: number | null;
  activityPaceMinPerKm?: number | null;
}

    const matchData = match as unknown as WorkoutMatchResult;
    if (!matchData.matched || !matchData.workoutId) {
      return { status: "SKIPPED", reason: matchData.reason || "No match" };
    }

    // STEP 2: Generate Coach Micro-Feedback (xAI or Rule-based)
    const feedback = await step.run("generate-coach-feedback", async () => {
      const hasValidApiKey =
        process.env.XAI_API_KEY &&
        process.env.XAI_API_KEY.length > 5 &&
        !process.env.XAI_API_KEY.includes("your-xai-api-key");

      if (hasValidApiKey) {
        try {
          const res = await xai.chat.completions.create({
            model: process.env.XAI_MODEL || XAI_DEFAULT_MODEL,
            messages: [
              {
                role: "system",
                content: "Du bist der DorfDüsen Laufcoach. Gib dem Läufer ein kurzes, prägnantes 2-Satz Feedback zum absolvierten Lauf im Vergleich zum Trainingsplan (Lob oder sanfter Hinweis bzgl. Pace/Puls). Antworte auf Deutsch.",
              },
              {
                role: "user",
                content: `Geplant: ${matchData.workoutTitle}, Soll-Distanz: ${matchData.targetDistance} km, Ziel-Pulszone: Zone ${matchData.targetHrZone}.
Tatsächlich gelaufen: ${matchData.activityDistanceKm} km, Ø Puls: ${matchData.activityAvgHr || "unbekannt"} bpm.`,
              },
            ],
            max_tokens: 120,
            temperature: 0.5,
          });

          return res.choices[0]?.message?.content || "Starke Einheit! Weiter so.";
        } catch {
          // Fallback below
        }
      }

      // Rule-based fallback feedback
      const actualKm = matchData.activityDistanceKm ?? 0;
      if (matchData.targetDistance && actualKm >= matchData.targetDistance * 0.9) {
        return `Klasse Leistung! Du hast das geplante Soll von ${matchData.targetDistance} km mit ${actualKm} km souverän absolviert.`;
      }
      return `Einheit erfasst (${actualKm} km). Gönn dir jetzt ausreichend Regeneration vor dem nächsten Lauf!`;
    });

    // STEP 3: Update workout record
    await step.run("update-workout-status", async () => {
      await db.planWorkout.update({
        where: { id: matchData.workoutId },
        data: {
          status: "COMPLETED",
          matchedActivityId: activityId,
          aiFeedback: feedback,
        },
      });
    });

    return { status: "COMPLETED", workoutId: matchData.workoutId, feedback };
  }
);
