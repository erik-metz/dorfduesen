import { xai, XAI_DEFAULT_MODEL } from "./xai";
import { PeriodizationPlanSkeleton } from "../training/periodization";
import { AthleteBaseline } from "../training/baseline";
import { TrainingPaces } from "../training/vdot";
import { HeartRateZone } from "../training/zones";

export interface GeneratedWorkout {
  dayOfWeek: number;
  date: string; // ISO date
  sportType: string;
  workoutType: "EASY" | "TEMPO" | "INTERVAL" | "LONGRUN" | "RECOVERY" | "REST";
  title: string;
  description: string;
  targetDistance?: number;
  targetDurationMinutes?: number;
  targetPaceMin?: string;
  targetPaceMax?: string;
  targetHrZone?: number;
  structuredSteps?: Record<string, unknown>;
}

export interface GeneratedWeek {
  weekNumber: number;
  phase: string;
  targetDistance: number;
  isDeloadWeek: boolean;
  focusTitle: string;
  workouts: GeneratedWorkout[];
}

export interface PlanGenerationContext {
  planTitle: string;
  goalType: string;
  athleteBaseline: AthleteBaseline;
  paces: TrainingPaces;
  zones: HeartRateZone[];
  skeleton: PeriodizationPlanSkeleton;
}

/**
 * Calls xAI (Grok) to enrich and detail the periodized skeleton into full,
 * motivating, sport-scientifically validated workouts.
 */
export async function generatePlanWithGrok(
  context: PlanGenerationContext
): Promise<GeneratedWeek[]> {
  const hasValidApiKey =
    process.env.XAI_API_KEY &&
    process.env.XAI_API_KEY.length > 5 &&
    !process.env.XAI_API_KEY.includes("your-xai-api-key");

  if (!hasValidApiKey) {
    console.warn("[xAI Generator] No XAI_API_KEY set. Using algorithmic sports-science generator fallback.");
    return generateAlgorithmicPlan(context);
  }

  try {
    const prompt = buildGrokPrompt(context);

    const response = await xai.chat.completions.create({
      model: process.env.XAI_MODEL || XAI_DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `Du bist der "DorfDüsen Smart Coach", ein professioneller, sportwissenschaftlicher Lauftrainer für den Lauf- und Radsportverein "DorfDüsen".
Deine Aufgabe ist es, für die bereitgestellten Rahmendaten der Wochen detaillierte, präzise und motivierende Laufeinheiten zu erstellen.
Wichtige Regeln:
1. 80/20 Prinzip (Polarisiertes Training): 80% des Volumens MUSS in Zone 2 (Grundlagenausdauer / Easy) stattfinden.
2. Der Sonntag ist immer der beliebte DorfDüsen-Vereinslauf (Long Run oder Gemeinschaftsrunde).
3. Halte dich exakt an die vorgegebenen Wochenkilometer und Pace-Zonen.
4. Gib IMMER valides JSON zurück, das dem gewünschten Schema entspricht. Keine Erklärungen außerhalb von JSON.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from xAI Grok");
    }

    const parsed = JSON.parse(content);
    if (parsed.weeks && Array.isArray(parsed.weeks)) {
      return alignGeneratedPlanWithDates(parsed.weeks, context.skeleton);
    }

    throw new Error("Invalid JSON structure from xAI Grok");
  } catch (err) {
    console.error("[xAI Generator Error]", err);
    // Fallback to algorithmic generator so user's background job never gets permanently stuck
    return generateAlgorithmicPlan(context);
  }
}

function buildGrokPrompt(ctx: PlanGenerationContext): string {
  const { skeleton, athleteBaseline, paces, zones, goalType, planTitle } = ctx;

  const skeletonSummary = skeleton.weeks.map((w) => ({
    weekNumber: w.weekNumber,
    phase: w.phase,
    targetKm: w.targetKm,
    isDeload: w.isDeloadWeek,
    days: w.daysDistribution.filter((d) => d.workoutType !== "REST"),
  }));

  return `
Erstelle die detaillierten Trainingseinheiten für folgenden Plan:
Titel: ${planTitle}
Ziel: ${goalType}
Dauer: ${skeleton.totalWeeks} Wochen

Athleten-Metriken:
- VDOT: ${athleteBaseline.estimatedVdot}
- Easy Pace: ${paces.easyMin} - ${paces.easyMax} min/km (Zone 2: ${zones[1].minHr}-${zones[1].maxHr} bpm)
- Schwellen-Pace (Threshold): ${paces.thresholdMin} - ${paces.thresholdMax} min/km (Zone 4)
- Intervall-Pace: ${paces.intervalMin} - ${paces.intervalMax} min/km (Zone 5)
- Historischer Ø: ${athleteBaseline.averageWeeklyKm} km/Woche

Vorgegebenes Periodisierungs-Gerüst (exakte Soll-Werte einhalten):
${JSON.stringify(skeletonSummary, null, 2)}

Gib ein JSON-Objekt mit der Eigenschaft "weeks" zurück:
{
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "BASE",
      "targetDistance": 25.0,
      "isDeloadWeek": false,
      "focusTitle": "Grundlage & Eingewöhnung",
      "workouts": [
        {
          "dayOfWeek": 2, // 0 = So, 1 = Mo, 2 = Di, etc.
          "sportType": "Run",
          "workoutType": "EASY",
          "title": "Lockere Grundlagenrunde",
          "description": "Erholungsbetonter Lauf im Wohlfühltempo...",
          "targetDistance": 6.5,
          "targetDurationMinutes": 40,
          "targetPaceMin": "${paces.easyMin}",
          "targetPaceMax": "${paces.easyMax}",
          "targetHrZone": 2
        }
      ]
    }
  ]
}
`;
}

/**
 * Fallback algorithmic generator (100% reliable, zero external dependencies).
 * Generates scientifically sound workouts matching Daniels tables.
 */
export function generateAlgorithmicPlan(ctx: PlanGenerationContext): GeneratedWeek[] {
  const { skeleton, paces } = ctx;

  return skeleton.weeks.map((w) => {
    const workouts: GeneratedWorkout[] = [];

    for (const d of w.daysDistribution) {
      if (d.workoutType === "REST") continue;

      let title = "";
      let desc = "";
      let paceMin = paces.easyMin;
      let paceMax = paces.easyMax;
      let hrZone = 2;
      const duration = Math.round(d.approximateKm * 6); // ~6 min/km avg

      if (d.workoutType === "LONGRUN") {
        title = "DorfDüsen Sunday Long Run";
        desc = `Langer, ruhiger Ausdauerlauf in Zone 2. Fokus auf Fettstoffwechsel und aerobe Grundlagenausdauer.`;
        paceMin = paces.easyMin;
        paceMax = paces.easyMax;
        hrZone = 2;
      } else if (d.workoutType === "TEMPO") {
        title = "Schwellenlauf / Threshold Tempo";
        desc = `2 km Einlaufen, danach ${Math.max(d.approximateKm - 4, 2)} km im kontrollierten Schwellentempo, 2 km Auslaufen.`;
        paceMin = paces.thresholdMin;
        paceMax = paces.thresholdMax;
        hrZone = 4;
      } else if (d.workoutType === "INTERVAL") {
        title = "VO2max Intervalltraining";
        desc = `2 km Einlaufen, 5x 800m zügig mit je 2 min Trabpause, 2 km Auslaufen.`;
        paceMin = paces.intervalMin;
        paceMax = paces.intervalMax;
        hrZone = 5;
      } else {
        title = "Lockerer Grundlagenausdauerlauf (GA1)";
        desc = `Entspannter Dauerlauf zur Stabilisierung der Grundlagenausdauer. Puls strikt in Zone 2 halten.`;
        paceMin = paces.easyMin;
        paceMax = paces.easyMax;
        hrZone = 2;
      }

      workouts.push({
        dayOfWeek: d.dayOfWeek,
        date: "", // Filled in alignment
        sportType: "Run",
        workoutType: d.workoutType,
        title,
        description: desc,
        targetDistance: d.approximateKm,
        targetDurationMinutes: duration,
        targetPaceMin: paceMin,
        targetPaceMax: paceMax,
        targetHrZone: hrZone,
      });
    }

    return {
      weekNumber: w.weekNumber,
      phase: w.phase,
      targetDistance: w.targetKm,
      isDeloadWeek: w.isDeloadWeek,
      focusTitle: w.focusTitle,
      workouts,
    };
  });
}

function alignGeneratedPlanWithDates(
  generatedWeeks: GeneratedWeek[],
  skeleton: PeriodizationPlanSkeleton
): GeneratedWeek[] {
  const startDate = new Date(skeleton.startDate);

  return generatedWeeks.map((gw, wIndex) => {
    const weekStart = new Date(startDate.getTime() + wIndex * 7 * 24 * 60 * 60 * 1000);
    const skeletonWeek = skeleton.weeks[wIndex] || skeleton.weeks[0];

    const workouts: GeneratedWorkout[] = (gw.workouts || []).map((wo: GeneratedWorkout) => {
      // Calculate workout date based on dayOfWeek (0 = Sunday, 1 = Monday, etc.)
      const workoutDate = new Date(weekStart);
      const dayOffset = wo.dayOfWeek === 0 ? 6 : wo.dayOfWeek - 1; // Start of week is Monday
      workoutDate.setDate(weekStart.getDate() + dayOffset);

      return {
        dayOfWeek: wo.dayOfWeek,
        date: workoutDate.toISOString(),
        sportType: wo.sportType || "Run",
        workoutType: wo.workoutType || "EASY",
        title: wo.title || "Laufeinheit",
        description: wo.description || "",
        targetDistance: wo.targetDistance ? Number(wo.targetDistance) : undefined,
        targetDurationMinutes: wo.targetDurationMinutes ? Number(wo.targetDurationMinutes) : undefined,
        targetPaceMin: wo.targetPaceMin || undefined,
        targetPaceMax: wo.targetPaceMax || undefined,
        targetHrZone: wo.targetHrZone ? Number(wo.targetHrZone) : 2,
        structuredSteps: wo.structuredSteps || undefined,
      };
    });

    return {
      weekNumber: gw.weekNumber || wIndex + 1,
      phase: gw.phase || skeletonWeek.phase,
      targetDistance: Number(gw.targetDistance || skeletonWeek.targetKm),
      isDeloadWeek: Boolean(gw.isDeloadWeek || skeletonWeek.isDeloadWeek),
      focusTitle: gw.focusTitle || skeletonWeek.focusTitle,
      workouts,
    };
  });
}
