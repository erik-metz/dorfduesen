import type { AthleteBaseline } from './baseline-calculation';
import type { PeriodizationPlanSkeleton, PeriodizationWeekSkeleton, PeriodizationWorkoutSkeleton, TrainingPhase } from './periodization';

/** One run/walk session: warm-up walk, `repeats` × (run, walk), cool-down walk. */
export interface RunWalkSession {
  warmupWalkMinutes: number;
  repeats: number;
  runMinutes: number;
  walkMinutes: number;
  cooldownWalkMinutes: number;
  /** Final session of the plan: cover the target distance without walking breaks. */
  goalRunKm?: number;
}

const RUN_WALK_GOALS = new Set(['5K', '10K', 'GENERAL_FITNESS', 'BASE_BUILD', 'FITNESS_BUILD', 'WEIGHT_LOSS', 'ROUTINE']);
/** Conservative beginner pace used only for minute and distance estimates. */
const BEGINNER_RUN_MIN_PER_KM = 7.5;
const WALK_MIN_PER_KM = 12;
/** Athletes who can already run this long without stopping get the regular plan. */
const CONTINUOUS_RUN_READY_MINUTES = 25;

export interface RunWalkStart { startMinutes: number; goalMinutes: number; targetKm: number }

/**
 * Decides whether a beginner progression is needed. The stated ability wins; without one,
 * an athlete without recorded runs is treated as a beginner instead of an assumed runner.
 */
export function runWalkStart(input: { goalType: string; targetDistanceKm?: number; currentRunMinutes?: number; baseline: AthleteBaseline }): RunWalkStart | null {
  if (!RUN_WALK_GOALS.has(input.goalType)) return null;
  const targetKm = input.targetDistanceKm ?? (input.goalType === '10K' ? 10 : 5);
  if (!(targetKm > 0) || targetKm > 10) return null;
  const known = input.currentRunMinutes ?? (input.baseline.runCount === 0 ? 0 : input.baseline.longestRunKm * BEGINNER_RUN_MIN_PER_KM);
  if (known >= CONTINUOUS_RUN_READY_MINUTES) return null;
  const goalMinutes = Math.min(Math.round(targetKm * BEGINNER_RUN_MIN_PER_KM), 80);
  return { startMinutes: Math.max(1, Math.min(Math.floor(known), goalMinutes)), goalMinutes, targetKm };
}

const lerp = (from: number, to: number, ratio: number) => from + (to - from) * ratio;
const niceMinutes = (minutes: number) => minutes < 3 ? Math.max(1, Math.round(minutes * 2) / 2) : Math.round(minutes);
const walkFor = (run: number) => run <= 1 ? 1.5 : run <= 3 ? 2 : run < 15 ? 3 : 2;

/** Session at a progress ratio between 0 (first week) and 1 (continuous goal duration). */
export function runWalkSession(start: number, goal: number, progress: number): RunWalkSession {
  const totalRun = lerp(Math.max(start, Math.min(start * 8, goal * 0.6)), goal, progress);
  // Run blocks grow geometrically and become one continuous run late in the plan.
  const block = Math.min(totalRun, start * Math.pow(goal / start, Math.min(progress / 0.85, 1)));
  const ratio = totalRun / block;
  const repeats = ratio < 1.35 ? 1 : Math.max(2, Math.round(ratio));
  const runMinutes = repeats === 1 ? Math.round(totalRun) : niceMinutes(totalRun / repeats);
  return { warmupWalkMinutes: 5, repeats, runMinutes, walkMinutes: repeats === 1 ? 0 : walkFor(runMinutes), cooldownWalkMinutes: 5 };
}

export function runWalkDurationMinutes(session: RunWalkSession) {
  const main = session.goalRunKm ? session.goalRunKm * BEGINNER_RUN_MIN_PER_KM : session.repeats * session.runMinutes + (session.repeats - 1) * session.walkMinutes;
  return Math.round(session.warmupWalkMinutes + main + session.cooldownWalkMinutes);
}

/** Distance of the main part (without warm-up and cool-down walking). */
export function runWalkDistanceKm(session: RunWalkSession) {
  if (session.goalRunKm) return session.goalRunKm;
  const km = session.repeats * session.runMinutes / BEGINNER_RUN_MIN_PER_KM + (session.repeats - 1) * session.walkMinutes / WALK_MIN_PER_KM;
  return Math.round(km * 10) / 10;
}

const fmt = (minutes: number) => String(minutes).replace('.', ',');

export function describeRunWalk(session: RunWalkSession) {
  if (session.goalRunKm) return `${fmt(session.goalRunKm)} km am Stück`;
  if (session.repeats === 1) return `${fmt(session.runMinutes)} Minuten am Stück laufen`;
  return `${session.repeats}× ${fmt(session.runMinutes)} min laufen / ${fmt(session.walkMinutes)} min gehen`;
}

const SCHEDULES: Record<number, number[]> = { 2: [2, 0], 3: [2, 4, 0] };

export function buildRunWalkSkeleton(input: {
  start: RunWalkStart; totalWeeks: number; startDate: Date; targetDate: Date; daysAvailable: number;
  preferredLongRunDay?: number | null; includeSundayRun: boolean; gentlerStart?: boolean;
}): PeriodizationPlanSkeleton {
  const { start, totalWeeks } = input;
  // Beginners need a rest day between sessions; three sessions are plenty.
  const days = [...SCHEDULES[Math.min(Math.max(input.daysAvailable, 2), 3)]];
  if (!input.includeSundayRun) days[days.length - 1] = 6;
  const preferred = input.preferredLongRunDay;
  const goalDay = preferred !== null && preferred !== undefined && preferred >= 0 && days.includes(preferred) ? preferred : days[days.length - 1];

  // Every fourth week and the gentler first week repeat the previous level instead of progressing.
  const steps: number[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const hold = w > 1 && w < totalWeeks && (w % 4 === 0 || (w === 2 && input.gentlerStart));
    steps.push(w === 1 ? 0 : steps[w - 2] + (hold ? 0 : 1));
  }
  const lastStep = Math.max(steps[totalWeeks - 1], 1);

  const weeks: PeriodizationWeekSkeleton[] = steps.map((step, index) => {
    const weekNumber = index + 1;
    const isGoalWeek = weekNumber === totalWeeks;
    const isDeloadWeek = weekNumber > 1 && step === steps[index - 1];
    const progress = step / lastStep;
    const session = runWalkSession(start.startMinutes, start.goalMinutes, progress);
    const phase: TrainingPhase = isGoalWeek ? 'PEAK' : session.repeats === 1 ? 'BUILD' : 'BASE';
    const daysDistribution: PeriodizationWorkoutSkeleton[] = [];
    for (let day = 0; day < 7; day++) {
      if (!days.includes(day)) {
        daysDistribution.push({ dayOfWeek: day, workoutType: 'REST', approximateKm: 0, isFlexible: true, recommendedTiming: 'Ruhetag' });
        continue;
      }
      // The goal week stays light until the final continuous run on the goal day.
      const daySession: RunWalkSession = isGoalWeek
        ? day === goalDay
          ? { warmupWalkMinutes: 5, repeats: 1, runMinutes: start.goalMinutes, walkMinutes: 0, cooldownWalkMinutes: 5, goalRunKm: start.targetKm }
          : runWalkSession(start.startMinutes, start.goalMinutes, Math.max((lastStep - 2) / lastStep, 0))
        : session;
      const clubRun = day === 0 && input.includeSundayRun;
      daysDistribution.push({
        dayOfWeek: day,
        workoutType: isGoalWeek && day === goalDay ? 'LONGRUN' : 'EASY',
        approximateKm: runWalkDistanceKm(daySession),
        isFlexible: !clubRun,
        recommendedTiming: clubRun ? 'Sonntag 09:00 Uhr (DorfDüsen Sunday Run)' : day === goalDay && isGoalWeek ? 'Dein Zieltag' : 'Unter der Woche',
        runWalk: daySession,
      });
    }
    const focusTitle = isGoalWeek
      ? `Zielwoche: ${fmt(start.targetKm)} km am Stück`
      : isDeloadWeek
        ? `Festigungswoche: ${describeRunWalk(session)}`
        : `Woche ${weekNumber}: ${describeRunWalk(session)}`;
    return {
      weekNumber, phase, isDeloadWeek, focusTitle, daysDistribution,
      targetKm: Math.round(daysDistribution.reduce((sum, day) => sum + day.approximateKm, 0) * 10) / 10,
    };
  });

  return {
    mode: 'RUN_WALK', totalWeeks, startDate: input.startDate, targetDate: input.targetDate,
    startingWeeklyKm: weeks[0].targetKm, peakWeeklyKm: Math.max(...weeks.map(week => week.targetKm)), weeks,
  };
}
