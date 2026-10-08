import { dayKey, berlinMidnight, shiftDay } from '@/lib/time';
import { xai, XAI_DEFAULT_MODEL } from "./xai";
import { PeriodizationPlanSkeleton } from "../training/periodization";
import { AthleteBaseline } from "../training/baseline";
import { TrainingPaces, paceToSecondsPerKm } from "../training/vdot";
import { HeartRateZone } from "../training/zones";
import { validateGeneratedWeeks } from '../training/generated-plan-validation';

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
  isFlexible?: boolean;
  recommendedTiming?: string;
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
  goalSubtype?: string;
  goalDescription?: string;
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
2. Der sonntägliche DorfDüsen-Vereinslauf (Sunday Run) ist IMMER standardmäßig mindestens 5.0 km (Gemeinschaftsrunde in Nordheim, offizieller Strava-Club-Termin). Er darf niemals unter 5.0 km liegen.
3. Passe Einheiten und Tonalität exakt an das Ziel an (z. B. Kondition/Durchhalten, Schwellentempo/1-Min schneller, Fettverbrennung/Gewicht, Gewohnheit/Routine).
4. Halte dich exakt an die vorgegebenen Wochenkilometer und Pace-Zonen.
5. Gib IMMER valides JSON zurück, das dem gewünschten Schema entspricht. Keine Erklärungen außerhalb von JSON.`,
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
      validateGeneratedWeeks(parsed.weeks, context.skeleton, context.paces);
      return alignGeneratedPlanWithDates(parsed.weeks, context.skeleton);
    }

    throw new Error("Invalid JSON structure from xAI Grok");
  } catch (err) {
    console.error("[xAI Generator Error]", err);
    // Fallback to algorithmic generator so user's background job never gets permanently stuck
    return generateAlgorithmicPlan(context);
  }
}

function getGoalGuidance(goalType: string, goalDescription?: string): string {
  switch (goalType) {
    case "FITNESS_BUILD":
      return `Sportwissenschaftlicher Schwerpunkt: ALLGEMEINE KONDITION & DURCHHALTEN.
- Der Athlet will fitter werden und längere Strecken ohne Erschöpfung durchlaufen können.
- 90% des Trainings im aeroben Wohlfühltempo (Zone 2). Keine harten anaeroben Reize!
- Fokus auf zeitbasiertes Durchhalten (z. B. 30–60 Min am Stück) und Stärkung des Herz-Kreislauf-Systems.
- Details/Wunsch: ${goalDescription || "Ausdauer schrittweise aufbauen"}`;

    case "SPEED_IMPROVE":
      return `Sportwissenschaftlicher Schwerpunkt: SCHNELLIGKEIT & PACE-OPTIMIERUNG (z.B. Bestzeit / 1 Min schneller).
- Gezielte Schwellenläufe (Zone 4) an der individuellen Laktatschwelle zur Steigerung der Tempohärte.
- Präzise VO2max-Intervalle (Zone 5) mit Erholungstrabpausen.
- 80% polarisiertes Grundlagentraining in Zone 2, damit die Tempotage mit maximaler Qualität gelaufen werden.
- Details/Wunsch: ${goalDescription || "Pace verbessern & Schwellenhärte trainieren"}`;

    case "WEIGHT_LOSS":
      return `Sportwissenschaftlicher Schwerpunkt: GEWICHTSMANAGEMENT & FETTSTOFFWECHSEL.
- Maximale Fettoxidation: Langer, ruhiger Pulsbereich strikt in Zone 2.
- Gelenkschonend: Defensiver Kraftaufbau, Überlastung und Sehnenreizungen unbedingt vermeiden.
- Am Ende kurzer Läufe 3-4 lockere Steigerungen (Strides) für neuromuskulären Reiz und Nachbrenneffekt.
- Motivierende Tipps zu Hydration und ausgewogener Regeneration.
- Details/Wunsch: ${goalDescription || "Fettverbrennung und Wohlfühlgewicht"}`;

    case "ROUTINE":
      return `Sportwissenschaftlicher Schwerpunkt: LAUFROUTINE & WIEDEREINSTIEG.
- Feste Gewohnheit aufbauen (z. B. 2-3 verlässliche Einheiten pro Woche) oder sanfter Neustart nach Pause.
- Niederschwellig und genussvoll: Kein Leistungsdruck, kein Ausbrennen.
- Freude an der Bewegung und mentale Erholung stehen im Mittelpunkt.
- Details/Wunsch: ${goalDescription || "Feste Laufgewohnheit etablieren"}`;

    default:
      return `Sportwissenschaftlicher Schwerpunkt: WETTKAMPF- & DISTANZVORBEREITUNG (${goalType}).
- Systematische Periodisierung mit schrittweiser Steigerung des langen Laufs und rennspezifischen Paces.
- Details/Wunsch: ${goalDescription || `Erfolgreiches Finishen von ${goalType}`}`;
  }
}

function buildGrokPrompt(ctx: PlanGenerationContext): string {
  const { skeleton, athleteBaseline, paces, zones, goalType, planTitle, goalDescription } = ctx;

  const skeletonSummary = skeleton.weeks.map((w) => ({
    weekNumber: w.weekNumber,
    phase: w.phase,
    targetKm: w.targetKm,
    isDeload: w.isDeloadWeek,
    focusTitle: w.focusTitle,
    days: w.daysDistribution.filter((d) => d.workoutType !== "REST"),
  }));

  const goalGuidance = getGoalGuidance(goalType, goalDescription);

  return `
Erstelle die detaillierten Trainingseinheiten für folgenden Plan:
Titel: ${planTitle}
Ziel-Typ: ${goalType}
Dauer: ${skeleton.totalWeeks} Wochen

${goalGuidance}

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

  const unalignedWeeks = skeleton.weeks.map((w) => {
    const workouts: GeneratedWorkout[] = [];

    for (const d of w.daysDistribution) {
      if (d.workoutType === "REST") continue;

      let title = "";
      let desc = "";
      let paceMin = paces.easyMin;
      let paceMax = paces.easyMax;
      let hrZone = 2;

      if (d.dayOfWeek === 0) {
        title = "DorfDüsen Sunday Run (5 km) – Strava Club-Termin";
        desc = "Offizieller Vereinstermin in Nordheim (Gemeinde Biblis). Treffpunkt jeden Sonntag 09:00 Uhr. Lockere 5-km-Gemeinschaftsrunde im Wohlfühltempo (Zone 2) – niemand läuft alleine!";
        paceMin = paces.easyMin;
        paceMax = paces.easyMax;
        hrZone = 2;
      } else if (d.workoutType === "LONGRUN") {
        if (ctx.goalType === "WEIGHT_LOSS") {
          title = "Fettstoffwechsel-Ausdauerlauf (Zone 2)";
          desc = "Langer, gleichmäßiger Dauerlauf im optimalen Fettverbrennungsbereich (Zone 2). Ausreichend trinken!";
        } else if (ctx.goalType === "FITNESS_BUILD") {
          title = "Aerobe Ausdauer-Erweiterung";
          desc = "Längerer Lauf im Wohlfühltempo zur Stärkung von Herz und Lunge. Fokus auf entspanntes Durchhalten.";
        } else if (ctx.goalType === "ROUTINE") {
          title = "Wochenend-Genusslauf";
          desc = "Schöne Laufrunde in der Natur ohne Zeitdruck zur Pflege deiner wöchentlichen Laufgewohnheit.";
        } else {
          title = "Langer Ausdauerlauf (Long Run)";
          desc = "Ruhiger, langer Grundlagenlauf in Zone 2. Fokus auf Fettstoffwechsel und aerobe Kapazität.";
        }
        paceMin = paces.easyMin;
        paceMax = paces.easyMax;
        hrZone = 2;
      } else if (d.workoutType === "TEMPO") {
        if (ctx.goalType === "SPEED_IMPROVE") {
          title = "Schwellenlauf zur Pace-Verschiebung";
          desc = `2 km Einlaufen, danach ${Math.max(d.approximateKm - 4, 2)} km kontrolliertes Schwellentempo (Zone 4), 2 km Auslaufen.`;
        } else {
          title = "Schwellenlauf / Threshold Tempo";
          desc = `2 km Einlaufen, danach ${Math.max(d.approximateKm - 4, 2)} km im kontrollierten Schwellentempo, 2 km Auslaufen.`;
        }
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
        if (ctx.goalType === "WEIGHT_LOSS") {
          title = "Aktiver Fettverbrennungs-Dauerlauf";
          desc = "Lockerer Dauerlauf in Zone 2 mit 3 kurzen Steigerungen am Ende zur Aktivierung des Nachbrenneffekts.";
        } else if (ctx.goalType === "FITNESS_BUILD") {
          title = "Konditionsaufbau im Wohlfühltempo";
          desc = "Gleichmäßiges Laufen in Zone 2. Sprechen muss jederzeit problemlos möglich sein.";
        } else if (ctx.goalType === "ROUTINE") {
          title = "Entspannte Gewohnheits-Runde";
          desc = "Kurze, unkomplizierte Einheit. Einfach Laufschuhe schnüren und aktiv den Kopf freibekommen.";
        } else {
          title = "Lockerer Grundlagenausdauerlauf (GA1)";
          desc = "Entspannter Dauerlauf zur Stabilisierung der Grundlagenausdauer. Puls strikt in Zone 2 halten.";
        }
        paceMin = paces.easyMin;
        paceMax = paces.easyMax;
        hrZone = 2;
      }

      const avgPaceSec = (paceToSecondsPerKm(paceMin) + paceToSecondsPerKm(paceMax)) / 2;
      const duration = Math.round((d.approximateKm * avgPaceSec) / 60);

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
        isFlexible: d.isFlexible,
        recommendedTiming: d.recommendedTiming,
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

  return alignGeneratedPlanWithDates(unalignedWeeks, skeleton);
}

function alignGeneratedPlanWithDates(
  generatedWeeks: GeneratedWeek[],
  skeleton: PeriodizationPlanSkeleton
): GeneratedWeek[] {
  const startKey = dayKey(new Date(skeleton.startDate));

  return generatedWeeks.map((gw, wIndex) => {
    const weekKey = shiftDay(startKey, wIndex * 7);
    const skeletonWeek = skeleton.weeks[wIndex] || skeleton.weeks[0];

    const workouts: GeneratedWorkout[] = (gw.workouts || []).map((wo: GeneratedWorkout) => {
      // Calculate workout date based on dayOfWeek (0 = Sunday, 1 = Monday, etc.)

      const dayOffset = wo.dayOfWeek === 0 ? 6 : wo.dayOfWeek - 1; // Start of week is Monday
      const workoutDate = berlinMidnight(shiftDay(weekKey, dayOffset));

      const matchingSkeletonDay = skeletonWeek.daysDistribution.find((d) => d.dayOfWeek === wo.dayOfWeek);

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
        isFlexible: wo.isFlexible ?? matchingSkeletonDay?.isFlexible ?? true,
        recommendedTiming: wo.recommendedTiming || matchingSkeletonDay?.recommendedTiming || "Woche",
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
