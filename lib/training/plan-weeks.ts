import type { Prisma } from '@prisma/client';
import type { GeneratedWeek } from '@/lib/ai/generator';

/** Nested create input for one generated plan week and its workouts. */
export function planWeekCreateData(planId: string, week: GeneratedWeek, focusTitle = week.focusTitle): Prisma.PlanWeekUncheckedCreateInput {
  return {
    planId, weekNumber: week.weekNumber, phase: week.phase,
    targetDistance: week.targetDistance, isDeloadWeek: week.isDeloadWeek, focusTitle,
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
  };
}
