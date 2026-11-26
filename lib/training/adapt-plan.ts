import { db } from '@/lib/db';
import { generateAlgorithmicPlan } from '@/lib/ai/generator';
import { calculateAthleteBaseline } from './baseline';
import { buildPeriodizationSkeleton, type PeriodizationPlanSkeleton } from './periodization';
import { buildRunWalkSkeleton, runWalkLevel } from './run-walk';
import { adaptationMessage, reviewWeek, storedRunWalk, type WeekOutcome } from './plan-adaptation';
import { planWeekCreateData } from './plan-weeks';
import { getTrainingPaces } from './vdot';
import { berlinMidnight, dayKey, weekRange } from '@/lib/time';

const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

export type AdaptationResult =
  | { status: 'skipped'; reason: string }
  | { status: 'on_track'; weekNumber: number }
  | { status: 'adapted'; weekNumber: number; outcome: Exclude<WeekOutcome, 'ON_TRACK'> };

/**
 * Reviews the plan week that ended before `now` against the athlete's recorded runs and,
 * if it fell short, rebuilds the remaining weeks from the level actually reached.
 * Bounded work: one plan, a handful of queries, deterministic generation (no model calls).
 */
export async function adaptPlanAfterWeek(planId: string, now = new Date()): Promise<AdaptationResult> {
  const reviewed = weekRange(new Date(now.getTime() - 86400000));
  const plan = await db.trainingPlan.findFirst({
    where: { id: planId, status: 'ACTIVE' },
    include: { weeks: { orderBy: { weekNumber: 'asc' }, include: { workouts: { orderBy: { scheduledDate: 'asc' } } } } },
  });
  if (!plan) return { status: 'skipped', reason: 'Plan not active' };
  const week = plan.weeks.find(item => item.workouts.some(workout => weekRange(workout.scheduledDate).key === reviewed.key));
  if (!week) return { status: 'skipped', reason: 'No plan week in the reviewed week' };

  const adaptationKey = `plan-adaptation:${plan.id}:${week.weekNumber}`;
  if (await db.notification.findFirst({ where: { userId: plan.userId, metadata: { path: ['adaptationKey'], equals: adaptationKey } }, select: { id: true } })) {
    return { status: 'skipped', reason: 'Week already adapted' };
  }

  // Sessions scheduled before the plan existed cannot count as missed.
  const countedFrom = new Date(Math.max(reviewed.start.getTime(), berlinMidnight(dayKey(plan.createdAt)).getTime()));
  const planned = week.workouts.filter(workout => workout.workoutType !== 'REST' && workout.sportType === 'Run' && workout.scheduledDate >= countedFrom);
  if (!planned.length) return { status: 'skipped', reason: 'Nothing planned after plan creation' };
  const runs = await db.activity.findMany({
    where: { userId: plan.userId, sportType: { in: RUN_TYPES }, startDate: { gte: countedFrom, lt: reviewed.end } },
    select: { distance: true, manualDistance: true },
  });
  const distances = runs.map(run => (run.manualDistance ?? run.distance) / 1000);
  const review = {
    plannedSessions: planned.length,
    plannedKm: planned.reduce((sum, workout) => sum + (workout.targetDistance ?? 0), 0),
    completedSessions: distances.filter(km => km >= 1).length,
    actualKm: distances.reduce((sum, km) => sum + km, 0),
  };
  const { outcome } = reviewWeek(review);
  if (outcome === 'ON_TRACK') return { status: 'on_track', weekNumber: week.weekNumber };

  const remaining = plan.weeks.filter(item => item.weekNumber > week.weekNumber);
  // The goal week itself stays as planned; with nothing in between there is nothing to rebalance.
  if (remaining.length < 2) return { status: 'skipped', reason: 'Too close to the goal' };
  if (remaining.some(item => item.workouts.some(workout => workout.status !== 'PENDING'))) return { status: 'skipped', reason: 'Remaining weeks already in progress' };

  const profile = await db.userProfile.findUnique({ where: { userId: plan.userId } });
  const daysAvailable = profile?.weeklyAvailability ?? 3;
  const includeSundayRun = profile?.includeSundayRun ?? true;
  const preferredLongRunDay = profile?.preferredLongRunDay ?? null;
  const startDate = reviewed.end;
  const targetDate = plan.endDate;
  const previous = plan.weeks.find(item => item.weekNumber === week.weekNumber - 1);
  const sessionOf = (item: typeof week | undefined) => item?.workouts.map(workout => storedRunWalk(workout.structuredSteps)).find(session => session && !session.goalRunKm) ?? null;

  let skeleton: PeriodizationPlanSkeleton;
  let paces = getTrainingPaces(profile?.vdotScore ?? 35);
  const current = sessionOf(week);
  if (current) {
    const goal = plan.weeks.at(-1)?.workouts.map(workout => storedRunWalk(workout.structuredSteps)).find(session => session?.goalRunKm);
    if (!goal?.goalRunKm) return { status: 'skipped', reason: 'Goal session missing' };
    const back = outcome === 'STEP_BACK' ? sessionOf(previous) : null;
    const level = back ? runWalkLevel(back) : runWalkLevel(current);
    if (outcome === 'STEP_BACK' && !back) {
      level.startBlock = Math.max(1, Math.round(level.startBlock * 0.75 * 2) / 2);
      level.startTotalRun = Math.max(level.startBlock, Math.round(level.startTotalRun * 0.75));
    }
    skeleton = buildRunWalkSkeleton({
      start: { ...level, goalMinutes: goal.runMinutes, targetKm: goal.goalRunKm, paceMinPerKm: goal.paceMinPerKm ?? 7.5, basis: 'data' },
      totalWeeks: remaining.length, startDate, targetDate, daysAvailable, preferredLongRunDay, includeSundayRun,
      firstWeekNumber: week.weekNumber + 1,
    });
  } else {
    const { stats } = await calculateAthleteBaseline(plan.userId);
    paces = getTrainingPaces(profile?.vdotScore ?? stats.estimatedVdot);
    const base = outcome === 'STEP_BACK' ? (previous?.targetDistance ?? week.targetDistance) * 0.85 : week.targetDistance;
    skeleton = buildPeriodizationSkeleton({
      baseline: stats, goalType: plan.goalType, targetDistanceKm: plan.targetDistance ?? undefined,
      startDate, targetDate, weeklyAvailability: daysAvailable, preferredLongRunDay, includeSundayRun,
      firstWeekNumber: week.weekNumber + 1, startVolumeKm: Math.max(base, 3),
    });
  }
  if (skeleton.weeks.length !== remaining.length) return { status: 'skipped', reason: 'Remaining weeks do not match the plan dates' };

  const generated = generateAlgorithmicPlan({ goalType: plan.goalType, paces, skeleton });
  const message = adaptationMessage(outcome, review);
  const applied = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${plan.userId} FOR UPDATE`;
    const fresh = await tx.planWeek.findMany({
      where: { planId: plan.id, weekNumber: { gt: week.weekNumber } },
      select: { id: true, workouts: { select: { status: true } } },
    });
    const active = await tx.trainingPlan.count({ where: { id: plan.id, status: 'ACTIVE' } });
    if (!active || fresh.length !== remaining.length || fresh.some(item => item.workouts.some(workout => workout.status !== 'PENDING'))) return false;
    await tx.planWeek.deleteMany({ where: { id: { in: fresh.map(item => item.id) } } });
    for (const [index, item] of generated.entries()) {
      await tx.planWeek.create({ data: planWeekCreateData(plan.id, item, index === 0 ? `Angepasst: ${item.focusTitle}` : item.focusTitle) });
    }
    await tx.notification.create({ data: {
      userId: plan.userId, type: 'SYSTEM', title: 'Dein Trainingsplan wurde angepasst', message, link: '/coach',
      metadata: { adaptationKey, planId: plan.id, weekNumber: week.weekNumber, outcome, ...review },
    } });
    return true;
  }, { timeout: 30000 });
  if (!applied) return { status: 'skipped', reason: 'Plan changed during adaptation' };
  return { status: 'adapted', weekNumber: week.weekNumber, outcome };
}
