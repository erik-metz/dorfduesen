import { db } from '@/lib/db';
import { berlinMidnight, dayKey, shiftDay } from '@/lib/time';
import type { Prisma } from '@prisma/client';

export const DAILY_GENERATION_LIMIT = 5;
export function generationDay() {
  const key = dayKey();
  return { gte: berlinMidnight(key), lt: berlinMidnight(shiftDay(key, 1)) };
}

export async function reservePlan(userId: string, data: Omit<Prisma.TrainingPlanUncheckedCreateInput, 'userId'>) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const generationsToday = await tx.planGenerationAttempt.count({ where: { userId, createdAt: generationDay() } });
    if (generationsToday >= DAILY_GENERATION_LIMIT) return { kind: 'limit' as const, generationsToday };
    const pending = await tx.trainingPlan.findFirst({ where: { userId, status: { in: ['QUEUED', 'PROCESSING'] } } });
    if (pending) return { kind: 'pending' as const };
    const plan = await tx.trainingPlan.create({ data: { ...data, userId, status: 'QUEUED' } });
    await tx.planGenerationAttempt.create({ data: { userId, planId: plan.id } });
    return { kind: 'created' as const, plan };
  });
}
