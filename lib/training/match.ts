import { db } from '@/lib/db';

/** Lock the activity before checking and updating both sides of the match. */
export async function completeWorkoutOnce(userId: string, activityId: string, workoutId: string, feedback: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${activityId} FOR UPDATE`;
    const activity = await tx.activity.findFirst({ where: { id: activityId, userId } });
    const existing = await tx.planWorkout.findFirst({ where: { matchedActivityId: activityId } });
    if (!activity || existing) return false;
    const result = await tx.planWorkout.updateMany({
      where: { id: workoutId, status: 'PENDING', week: { plan: { userId, status: 'ACTIVE' } } },
      data: { status: 'COMPLETED', matchedActivityId: activityId, aiFeedback: feedback },
    });
    return result.count === 1;
  });
}
