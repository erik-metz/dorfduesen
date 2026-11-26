import type { AthleteBaseline } from './baseline-calculation';
import type { PeriodizationPlanSkeleton, PeriodizationWeekSkeleton, PeriodizationWorkoutSkeleton, TrainingPhase } from './periodization';

/** One run/walk session: warm-up walk, `repeats` × (run, walk), cool-down walk. */
export interface RunWalkSession {
  warmupWalkMinutes: number;
  repeats: number;
  runMinutes: number;
  walkMinutes: number;
  cooldownWalkMinutes: number;
  /** Pace estimate in min/km used for the distance hints. */
  paceMinPerKm?: number;
  /** Final session of the plan: cover the target distance without walking breaks. */
  goalRunKm?: number;
}

/** Where the progression starts and ends, derived from the athlete's own data or statement. */
export interface RunWalkStart {
  /** Longest run block in minutes in the first week. */
  startBlock: number;
  /** Running minutes per session in the first week (excluding walking). */
  startTotalRun: number;
  goalMinutes: number;
  targetKm: number;
  paceMinPerKm: number;
  basis: 'stated' | 'data' | 'none';
}

const RUN_WALK_GOALS = new Set(['5K', '10K', 'GENERAL_FITNESS', 'BASE_BUILD', 'FITNESS_BUILD', 'WEIGHT_LOSS', 'ROUTINE']);
const DEFAULT_PACE_MIN_PER_KM = 7.5;
const WALK_MIN_PER_KM = 11;
/** Athletes who can already run this long without stopping get the regular plan. */
const CONTINUOUS_RUN_READY_MINUTES = 25;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Decides whether a run/walk progression is needed and where it starts. A statement from the
 * athlete wins; otherwise the recent runs decide: their pace reveals walking breaks, their
 * duration and frequency set the first week's load. Without any runs the athlete starts from zero.
 */
export function runWalkStart(input: { goalType: string; targetDistanceKm?: number; currentRunMinutes?: number; baseline: AthleteBaseline; sessionsPerWeek: number }): RunWalkStart | null {
  if (!RUN_WALK_GOALS.has(input.goalType)) return null;
  const targetKm = input.targetDistanceKm ?? (input.goalType === '10K' ? 10 : 5);
  if (!(targetKm > 0) || targetKm > 10) return null;
  const recent = input.baseline.recent;
  const hasRecentRuns = Boolean(recent && recent.typicalRunMinutes > 0);
  const pace = hasRecentRuns ? recent.typicalPaceSecPerKm / 60 : 0;
  // A run/walk average is slower than continuous jogging; estimate the continuous pace slightly faster.
  const paceMinPerKm = hasRecentRuns ? Math.round(clamp(pace * (recent.likelyRunWalk ? 0.95 : 1), 5, 9.5) * 4) / 4 : DEFAULT_PACE_MIN_PER_KM;
  const goalMinutes = Math.min(Math.round(targetKm * paceMinPerKm), 90);

  let startBlock: number;
  let basis: RunWalkStart['basis'];
  if (input.currentRunMinutes !== undefined) {
    if (input.currentRunMinutes >= CONTINUOUS_RUN_READY_MINUTES) return null;
    startBlock = Math.max(1, Math.floor(input.currentRunMinutes));
    basis = 'stated';
  } else if (!hasRecentRuns) {
    if (input.baseline.runCount > 0 && input.baseline.longestRunKm * DEFAULT_PACE_MIN_PER_KM >= CONTINUOUS_RUN_READY_MINUTES * 1.5) return null;
    startBlock = 1;
    basis = 'none';
  } else if (recent.likelyRunWalk) {
    // Share of running time in the recorded sessions, between walking (11:00) and jogging (7:30) pace.
    const runShare = clamp((WALK_MIN_PER_KM - pace) / (WALK_MIN_PER_KM - DEFAULT_PACE_MIN_PER_KM), 0.2, 1);
    startBlock = runShare >= 0.85 ? 8 : runShare >= 0.7 ? 4 : runShare >= 0.5 ? 2 : 1;
    basis = 'data';
  } else {
    if (recent.typicalRunMinutes >= CONTINUOUS_RUN_READY_MINUTES) return null;
    startBlock = Math.max(1, recent.typicalRunMinutes);
    basis = 'data';
  }
  startBlock = Math.min(startBlock, goalMinutes);

  let startTotalRun = Math.max(startBlock, Math.min(startBlock * 8, goalMinutes * 0.6));
  if (hasRecentRuns) {
    const runShare = recent.likelyRunWalk ? clamp((WALK_MIN_PER_KM - pace) / (WALK_MIN_PER_KM - DEFAULT_PACE_MIN_PER_KM), 0.2, 1) : 1;
    // Stay near the usual session and grow the week by at most 30 % over the last four weeks.
    const usualSession = clamp(recent.typicalRunMinutes, 15, 60) * runShare;
    const weeklyCap = Math.max(recent.weeklyMinutes * runShare * 1.3, usualSession) / Math.max(input.sessionsPerWeek, 1);
    startTotalRun = Math.max(startBlock, Math.min(usualSession, weeklyCap, goalMinutes * 0.8));
  }
  return { startBlock, startTotalRun: Math.round(startTotalRun), goalMinutes, targetKm, paceMinPerKm, basis };
}

const lerp = (from: number, to: number, ratio: number) => from + (to - from) * ratio;
const niceMinutes = (minutes: number) => minutes < 3 ? Math.max(1, Math.round(minutes * 2) / 2) : Math.round(minutes);
const walkFor = (run: number) => run <= 1 ? 1.5 : run <= 3 ? 2 : run < 15 ? 3 : 2;

/** Session at a progress ratio between 0 (first week) and 1 (continuous goal duration). */
export function runWalkSession(start: Pick<RunWalkStart, 'startBlock' | 'startTotalRun' | 'goalMinutes' | 'paceMinPerKm'>, progress: number): RunWalkSession {
  const { startBlock, goalMinutes } = start;
  const totalRun = lerp(Math.max(start.startTotalRun, startBlock), goalMinutes, progress);
  // Run blocks grow geometrically and become one continuous run late in the plan.
  const block = Math.min(totalRun, startBlock * Math.pow(goalMinutes / startBlock, Math.min(progress / 0.85, 1)));
  const ratio = totalRun / block;
  const repeats = ratio < 1.35 ? 1 : Math.max(2, Math.round(ratio));
  const runMinutes = repeats === 1 ? Math.round(totalRun) : niceMinutes(totalRun / repeats);
  return { warmupWalkMinutes: 5, repeats, runMinutes, walkMinutes: repeats === 1 ? 0 : walkFor(runMinutes), cooldownWalkMinutes: 5, paceMinPerKm: start.paceMinPerKm };
}

export function runWalkDurationMinutes(session: RunWalkSession) {
  const pace = session.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM;
  const main = session.goalRunKm ? session.goalRunKm * pace : session.repeats * session.runMinutes + (session.repeats - 1) * session.walkMinutes;
  return Math.round(session.warmupWalkMinutes + main + session.cooldownWalkMinutes);
}

/** Distance of the main part (without warm-up and cool-down walking). */
export function runWalkDistanceKm(session: RunWalkSession) {
  if (session.goalRunKm) return session.goalRunKm;
  const pace = session.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM;
  const km = session.repeats * session.runMinutes / pace + (session.repeats - 1) * session.walkMinutes / WALK_MIN_PER_KM;
  return Math.round(km * 10) / 10;
}

const fmt = (minutes: number) => String(minutes).replace('.', ',');

export function describeRunWalk(session: RunWalkSession) {
  if (session.goalRunKm) return `${fmt(session.goalRunKm)} km am Stück`;
  if (session.repeats === 1) return `${fmt(session.runMinutes)} Minuten am Stück laufen`;
  return `${session.repeats}× ${fmt(session.runMinutes)} min laufen / ${fmt(session.walkMinutes)} min gehen`;
}

/** Level of a stored session, so a later re-plan can continue from it. */
export function runWalkLevel(session: RunWalkSession): Pick<RunWalkStart, 'startBlock' | 'startTotalRun'> {
  return { startBlock: session.runMinutes, startTotalRun: session.repeats * session.runMinutes };
}

const SCHEDULES: Record<number, number[]> = { 2: [2, 0], 3: [2, 4, 0] };

export function runWalkDays(daysAvailable: number, includeSundayRun: boolean) {
  // Beginners need a rest day between sessions; three sessions are plenty.
  const days = [...SCHEDULES[clamp(daysAvailable, 2, 3)]];
  if (!includeSundayRun) days[days.length - 1] = 6;
  return days;
}

export function buildRunWalkSkeleton(input: {
  start: RunWalkStart; totalWeeks: number; startDate: Date; targetDate: Date; daysAvailable: number;
  preferredLongRunDay?: number | null; includeSundayRun: boolean; gentlerStart?: boolean;
  /** Plan week number of the first generated week, for re-plans of the remaining weeks. */
  firstWeekNumber?: number;
}): PeriodizationPlanSkeleton {
  const { start, totalWeeks } = input;
  const firstWeekNumber = input.firstWeekNumber ?? 1;
  const lastWeekNumber = firstWeekNumber + totalWeeks - 1;
  const days = runWalkDays(input.daysAvailable, input.includeSundayRun);
  const preferred = input.preferredLongRunDay;
  const goalDay = preferred !== null && preferred !== undefined && preferred >= 0 && days.includes(preferred) ? preferred : days[days.length - 1];

  // Every fourth plan week and the gentler first week repeat the previous level instead of progressing.
  const steps: number[] = [];
  for (let index = 0; index < totalWeeks; index++) {
    const weekNumber = firstWeekNumber + index;
    const hold = index > 0 && weekNumber < lastWeekNumber && (weekNumber % 4 === 0 || (index === 1 && input.gentlerStart));
    steps.push(index === 0 ? 0 : steps[index - 1] + (hold ? 0 : 1));
  }
  const lastStep = Math.max(steps[totalWeeks - 1], 1);

  const weeks: PeriodizationWeekSkeleton[] = steps.map((step, index) => {
    const weekNumber = firstWeekNumber + index;
    const isGoalWeek = weekNumber === lastWeekNumber;
    const isDeloadWeek = index > 0 && step === steps[index - 1];
    const session = runWalkSession(start, step / lastStep);
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
          ? { warmupWalkMinutes: 5, repeats: 1, runMinutes: start.goalMinutes, walkMinutes: 0, cooldownWalkMinutes: 5, paceMinPerKm: start.paceMinPerKm, goalRunKm: start.targetKm }
          : runWalkSession(start, Math.max((lastStep - 2) / lastStep, 0))
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
