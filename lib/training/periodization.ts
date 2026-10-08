import { AthleteBaseline } from "./baseline";

export type TrainingPhase = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY";

export interface PeriodizationWorkoutSkeleton {
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  workoutType: "EASY" | "TEMPO" | "INTERVAL" | "LONGRUN" | "RECOVERY" | "REST";
  approximateKm: number;
  isFlexible: boolean;
  recommendedTiming: string;
}

export interface PeriodizationWeekSkeleton {
  weekNumber: number;
  phase: TrainingPhase;
  targetKm: number;
  isDeloadWeek: boolean;
  focusTitle: string;
  daysDistribution: PeriodizationWorkoutSkeleton[];
}

export interface PeriodizationPlanSkeleton {
  totalWeeks: number;
  startDate: Date;
  targetDate: Date;
  startingWeeklyKm: number;
  peakWeeklyKm: number;
  weeks: PeriodizationWeekSkeleton[];
}

export interface PeriodizationInput {
  baseline: AthleteBaseline;
  goalType: string; // 5K | 10K | HALF_MARATHON | MARATHON | GENERAL_FITNESS | BASE_BUILD | FITNESS_BUILD | SPEED_IMPROVE | WEIGHT_LOSS | ROUTINE
  targetDistanceKm?: number;
  goalSubtype?: string;
  goalDescription?: string;
  targetDate?: Date;
  startDate?: Date;
  weeklyAvailability?: number; // 2 to 6 days
  preferredLongRunDay?: number | null; // null or -1 = Flexibel, 0 = So, 1 = Mo, 2 = Di, etc.
  includeSundayRun?: boolean;
}

/**
 * Computes a sport-scientifically sound periodization skeleton
 * with safe mileage progression and deload weeks.
 */
export function buildPeriodizationSkeleton(input: PeriodizationInput): PeriodizationPlanSkeleton {
  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  // Ensure start date is beginning of week (Monday)
  const day = startDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  startDate.setDate(startDate.getDate() + diffToMonday);
  startDate.setHours(0, 0, 0, 0);

  let targetDate = input.targetDate ? new Date(input.targetDate) : undefined;

  let totalWeeks = 12;
  if (targetDate) {
    const diffMs = targetDate.getTime() - startDate.getTime();
    const calculatedWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    totalWeeks = Math.max(Math.min(calculatedWeeks, 24), 6);
  } else {
    // Default duration depending on goal
    if (input.goalType === "MARATHON") totalWeeks = 16;
    else if (input.goalType === "HALF_MARATHON") totalWeeks = 12;
    else if (input.goalType === "10K") totalWeeks = 10;
    else if (input.goalType === "5K") totalWeeks = 8;
    else if (input.goalType === "WEIGHT_LOSS") totalWeeks = 10;
    else if (input.goalType === "FITNESS_BUILD") totalWeeks = 8;
    else if (input.goalType === "SPEED_IMPROVE") totalWeeks = 8;
    else if (input.goalType === "ROUTINE") totalWeeks = 6;
    else totalWeeks = 8;

    targetDate = new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000);
  }

  const daysAvailable = Math.min(Math.max(input.weeklyAvailability || 3, 2), 6);
  const isFlexibleLongRun = input.preferredLongRunDay === null || input.preferredLongRunDay === undefined || input.preferredLongRunDay === -1;
  const longRunDay = (isFlexibleLongRun || input.preferredLongRunDay == null) ? 0 : input.preferredLongRunDay; // Default placeholder slot Sunday, but marked flexible

  // Starting volume based on user baseline
  const startVolume = Math.max(input.baseline.averageWeeklyKm * 0.9, 10);
  
  // Peak volume estimated based on goal
  let targetPeakVolume = startVolume * 1.35;
  if (input.goalType === "HALF_MARATHON") {
    targetPeakVolume = Math.max(targetPeakVolume, 38);
  } else if (input.goalType === "MARATHON") {
    targetPeakVolume = Math.max(targetPeakVolume, 55);
  } else if (input.goalType === "10K") {
    targetPeakVolume = Math.max(targetPeakVolume, 28);
  } else if (input.goalType === "5K") {
    targetPeakVolume = Math.max(targetPeakVolume, 22);
  } else if (input.goalType === "SPEED_IMPROVE") {
    targetPeakVolume = Math.max(targetPeakVolume, 24);
  } else if (input.goalType === "FITNESS_BUILD") {
    targetPeakVolume = Math.max(targetPeakVolume, 18);
  } else if (input.goalType === "WEIGHT_LOSS") {
    targetPeakVolume = Math.max(targetPeakVolume, 22);
  } else if (input.goalType === "ROUTINE") {
    targetPeakVolume = Math.max(targetPeakVolume, 15);
  }

  // Taper duration: 2 weeks for HM/Marathon, 1 week for other performance targets
  const taperWeeksCount = (input.goalType === "MARATHON" || input.goalType === "HALF_MARATHON") ? 2 : 1;

  const weeks: PeriodizationWeekSkeleton[] = [];
  let currentVolume = startVolume;

  for (let w = 1; w <= totalWeeks; w++) {
    let phase: TrainingPhase = "BASE";
    let isDeload = false;
    let focusTitle = "";

    const progressRatio = w / totalWeeks;

    if (w > totalWeeks - taperWeeksCount && (input.goalType === "MARATHON" || input.goalType === "HALF_MARATHON" || input.goalType === "10K" || input.goalType === "5K" || input.goalType === "SPEED_IMPROVE")) {
      phase = "TAPER";
      const taperStep = totalWeeks - w;
      currentVolume = targetPeakVolume * (0.6 + taperStep * 0.2);
      focusTitle = `Tapering: Frische tanken & aktivieren für dein Zieldatum`;
    } else if (progressRatio > 0.75) {
      phase = "PEAK";
      if (input.goalType === "WEIGHT_LOSS") {
        focusTitle = `Peak-Fettstoffwechsel: Kontinuität & hohe aerobe Effizienz`;
      } else if (input.goalType === "FITNESS_BUILD") {
        focusTitle = `Konditions-Höhepunkt: Maximale kontinuierliche Laufzeit`;
      } else if (input.goalType === "ROUTINE") {
        focusTitle = `Gefestigte Gewohnheit: Leichtigkeit im Laufalltag`;
      } else {
        focusTitle = `Peak-Phase: Höchste spezifische Belastung`;
      }
    } else if (progressRatio > 0.40) {
      phase = "BUILD";
      if (input.goalType === "WEIGHT_LOSS") {
        focusTitle = `Stoffwechsel-Aufbau: Längere aerobe Einheiten`;
      } else if (input.goalType === "FITNESS_BUILD") {
        focusTitle = `Ausdauer-Ausbau: Schrittweise Verlängerung der Laufdauer`;
      } else if (input.goalType === "ROUTINE") {
        focusTitle = `Rhythmus festigen: Konstante 2-3 Einheiten pro Woche`;
      } else {
        focusTitle = `Build-Phase: Schwellentraining & Tempohärte`;
      }
    } else {
      phase = "BASE";
      focusTitle = `Base-Phase: Aerobes Fundament (Zone 2)`;
    }

    // Every 4th week is deload (except in peak or taper)
    if (w % 4 === 0 && phase !== "TAPER" && phase !== "PEAK") {
      isDeload = true;
      currentVolume = currentVolume * 0.75;
      focusTitle = `Regenerationswoche: Superkompensation & Erholung`;
    } else if (phase !== "TAPER") {
      if (w > 1 && !weeks[w - 2].isDeloadWeek) {
        currentVolume = Math.min(currentVolume * 1.07, targetPeakVolume);
      }
    }

    const weeklyKm = Math.round(currentVolume * 10) / 10;

    // Distribute mileage across days
    const daysDistribution = distributeDays(
      weeklyKm,
      daysAvailable,
      longRunDay,
      isFlexibleLongRun,
      phase,
      input.includeSundayRun ?? true,
      input.goalType
    );

    weeks.push({
      weekNumber: w,
      phase,
      targetKm: weeklyKm,
      isDeloadWeek: isDeload,
      focusTitle,
      daysDistribution,
    });
  }

  return {
    totalWeeks,
    startDate,
    targetDate: targetDate || new Date(),
    startingWeeklyKm: Math.round(startVolume * 10) / 10,
    peakWeeklyKm: Math.round(targetPeakVolume * 10) / 10,
    weeks,
  };
}

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/**
 * Distributes weekly kilometers across running days
 */
function distributeDays(
  weeklyKm: number,
  daysCount: number,
  longRunDay: number,
  isFlexibleLongRun: boolean,
  phase: TrainingPhase,
  includeSundayRun: boolean,
  goalType?: string
): PeriodizationWorkoutSkeleton[] {
  // Available days selection
  const defaultDaySchedules: Record<number, number[]> = {
    2: [2, 0],              // Di, So
    3: [2, 4, 0],           // Di, Do, So
    4: [2, 4, 6, 0],        // Di, Do, Sa, So
    5: [1, 2, 4, 6, 0],     // Mo, Di, Do, Sa, So
    6: [1, 2, 3, 5, 6, 0],  // 6 Tage
  };

  const selectedDays = [...(defaultDaySchedules[daysCount] || defaultDaySchedules[3])];
  
  // Ensure chosen longRunDay is included
  if (!selectedDays.includes(longRunDay)) {
    selectedDays[selectedDays.length - 1] = longRunDay;
  }
  // Ensure Sunday (0) is included if includeSundayRun is true
  if (includeSundayRun && !selectedDays.includes(0)) {
    selectedDays[0] = 0;
  }

  // Sunday run is always standardmäßig 5.0 km (or longer for Marathon/HM)
  let sundayKm = 5.0;
  if ((goalType === "MARATHON" || goalType === "HALF_MARATHON") && phase !== "BASE") {
    sundayKm = Math.max(Math.round(weeklyKm * 0.35 * 10) / 10, 5.0);
  }

  const isSundayLongRun = longRunDay === 0 || isFlexibleLongRun;
  const otherDays = selectedDays.filter((d) => d !== (isSundayLongRun ? 0 : longRunDay));
  
  const remainingKm = Math.max(weeklyKm - (isSundayLongRun ? sundayKm : 5.0), otherDays.length * 3.5);
  const kmPerOtherDay = Math.max(Math.round((remainingKm / Math.max(otherDays.length, 1)) * 10) / 10, 3.5);

  const result: PeriodizationWorkoutSkeleton[] = [];

  for (let d = 0; d < 7; d++) {
    if (!selectedDays.includes(d)) {
      result.push({
        dayOfWeek: d,
        workoutType: "REST",
        approximateKm: 0,
        isFlexible: true,
        recommendedTiming: "Ruhetag",
      });
      continue;
    }

    if (d === 0 && includeSundayRun) {
      // Official DorfDüsen Sunday Run: Always standardmäßig 5 km!
      result.push({
        dayOfWeek: 0,
        workoutType: isSundayLongRun && (goalType === "MARATHON" || goalType === "HALF_MARATHON") ? "LONGRUN" : "EASY",
        approximateKm: sundayKm,
        isFlexible: false,
        recommendedTiming: "Sonntag 09:00 Uhr (DorfDüsen Sunday Run)",
      });
    } else if (d === longRunDay && !isSundayLongRun) {
      result.push({
        dayOfWeek: d,
        workoutType: "LONGRUN",
        approximateKm: Math.max(Math.round(weeklyKm * 0.33 * 10) / 10, 5.0),
        isFlexible: isFlexibleLongRun,
        recommendedTiming: isFlexibleLongRun ? "Wochenende / Nach Tagesform & Wetter" : `${DAY_NAMES[d]} (Fester Tag)`,
      });
    } else {
      let qualityType: "EASY" | "TEMPO" | "INTERVAL" = "EASY";
      const isQualityDay = d === otherDays[0] && (phase === "BUILD" || phase === "PEAK");

      if (isQualityDay) {
        if (goalType === "SPEED_IMPROVE") {
          qualityType = phase === "PEAK" ? "INTERVAL" : "TEMPO";
        } else if (goalType === "ROUTINE" || goalType === "WEIGHT_LOSS") {
          qualityType = "EASY";
        } else if (goalType === "FITNESS_BUILD") {
          qualityType = phase === "PEAK" ? "TEMPO" : "EASY";
        } else {
          qualityType = "TEMPO";
        }
      }

      result.push({
        dayOfWeek: d,
        workoutType: qualityType,
        approximateKm: kmPerOtherDay,
        isFlexible: true,
        recommendedTiming: "Unter der Woche",
      });
    }
  }

  return result;
}
