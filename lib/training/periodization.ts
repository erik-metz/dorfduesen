import { AthleteBaseline } from "./baseline";

export type TrainingPhase = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY";

export interface PeriodizationWeekSkeleton {
  weekNumber: number;
  phase: TrainingPhase;
  targetKm: number;
  isDeloadWeek: boolean;
  focusTitle: string;
  daysDistribution: {
    dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
    workoutType: "EASY" | "TEMPO" | "INTERVAL" | "LONGRUN" | "RECOVERY" | "REST";
    approximateKm: number;
  }[];
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
  goalType: string; // 5K | 10K | HALF_MARATHON | MARATHON | GENERAL_FITNESS | BASE_BUILD
  targetDistanceKm?: number;
  targetDate?: Date;
  startDate?: Date;
  weeklyAvailability?: number; // 2 to 6 days
  preferredLongRunDay?: number; // 0 = Sunday
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
    if (input.goalType === "5K") totalWeeks = 8;
    else if (input.goalType === "10K") totalWeeks = 10;
    else if (input.goalType === "HALF_MARATHON") totalWeeks = 12;
    else if (input.goalType === "MARATHON") totalWeeks = 16;
    else totalWeeks = 8;

    targetDate = new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000);
  }

  const daysAvailable = Math.min(Math.max(input.weeklyAvailability || 3, 2), 6);
  const longRunDay = input.preferredLongRunDay !== undefined ? input.preferredLongRunDay : 0; // Default Sunday

  // Starting volume based on user baseline
  const startVolume = Math.max(input.baseline.averageWeeklyKm * 0.9, 12);
  
  // Peak volume estimated based on goal
  let targetPeakVolume = startVolume * 1.4;
  if (input.goalType === "HALF_MARATHON") {
    targetPeakVolume = Math.max(targetPeakVolume, 38);
  } else if (input.goalType === "MARATHON") {
    targetPeakVolume = Math.max(targetPeakVolume, 55);
  } else if (input.goalType === "10K") {
    targetPeakVolume = Math.max(targetPeakVolume, 28);
  } else if (input.goalType === "5K") {
    targetPeakVolume = Math.max(targetPeakVolume, 22);
  }

  // Taper duration: 2 weeks for HM/Marathon, 1 week for 5k/10k
  const taperWeeksCount = (input.goalType === "MARATHON" || input.goalType === "HALF_MARATHON") ? 2 : 1;

  const weeks: PeriodizationWeekSkeleton[] = [];
  let currentVolume = startVolume;

  for (let w = 1; w <= totalWeeks; w++) {
    let phase: TrainingPhase = "BASE";
    let isDeload = false;
    let focusTitle = "";

    const progressRatio = w / totalWeeks;

    if (w > totalWeeks - taperWeeksCount) {
      phase = "TAPER";
      // Taper reduces volume to 60% then 40%
      const taperStep = totalWeeks - w;
      currentVolume = targetPeakVolume * (0.5 + taperStep * 0.2);
      focusTitle = `Tapering Woche ${taperWeeksCount - taperStep}: Frische tanken & aktivieren`;
    } else if (progressRatio > 0.75) {
      phase = "PEAK";
      focusTitle = `Peak-Phase: Höchste spezifische Belastung`;
    } else if (progressRatio > 0.40) {
      phase = "BUILD";
      focusTitle = `Build-Phase: Schwellentraining & Tempohärte`;
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
      // Normal progression: +6% to +8%
      if (w > 1 && !weeks[w - 2].isDeloadWeek) {
        currentVolume = Math.min(currentVolume * 1.07, targetPeakVolume);
      }
    }

    const weeklyKm = Math.round(currentVolume * 10) / 10;

    // Distribute mileage across days
    const daysDistribution = distributeDays(weeklyKm, daysAvailable, longRunDay, phase);

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

/**
 * Distributes weekly kilometers across running days
 */
function distributeDays(
  weeklyKm: number,
  daysCount: number,
  longRunDay: number,
  phase: TrainingPhase
) {
  // Long run takes ~30-35% of weekly mileage
  const longRunKm = Math.round(weeklyKm * 0.33 * 10) / 10;
  const remainingKm = Math.max(weeklyKm - longRunKm, 4);

  // Available days selection (Monday = 1, Wednesday = 3, Friday = 5, Saturday = 6, Sunday = 0)
  const defaultDaySchedules: Record<number, number[]> = {
    2: [2, 0],              // Tue, Sun
    3: [2, 4, 0],           // Tue, Thu, Sun
    4: [2, 4, 6, 0],        // Tue, Thu, Sat, Sun
    5: [1, 2, 4, 6, 0],     // Mon, Tue, Thu, Sat, Sun
    6: [1, 2, 3, 5, 6, 0],  // 6 days
  };

  const selectedDays = defaultDaySchedules[daysCount] || defaultDaySchedules[3];
  
  // Ensure longRunDay is included
  if (!selectedDays.includes(longRunDay)) {
    selectedDays[selectedDays.length - 1] = longRunDay;
  }

  const otherDays = selectedDays.filter((d) => d !== longRunDay);
  const kmPerOtherDay = Math.round((remainingKm / Math.max(otherDays.length, 1)) * 10) / 10;

  const result: PeriodizationWeekSkeleton["daysDistribution"] = [];

  for (let d = 0; d < 7; d++) {
    if (d === longRunDay) {
      result.push({
        dayOfWeek: d,
        workoutType: "LONGRUN",
        approximateKm: longRunKm,
      });
    } else if (otherDays.includes(d)) {
      // Determine quality day vs easy day
      const isQualityDay = d === otherDays[0] && (phase === "BUILD" || phase === "PEAK");
      result.push({
        dayOfWeek: d,
        workoutType: isQualityDay ? "TEMPO" : "EASY",
        approximateKm: kmPerOtherDay,
      });
    } else {
      result.push({
        dayOfWeek: d,
        workoutType: "REST",
        approximateKm: 0,
      });
    }
  }

  return result;
}
