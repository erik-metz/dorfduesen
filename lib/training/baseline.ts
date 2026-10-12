import { db } from "@/lib/db";
import { baselineFromActivities } from "./baseline-calculation";
export type { AthleteBaseline } from "./baseline-calculation";

export async function calculateAthleteBaseline(userId: string) {
  const now = new Date();
  const [activities, profile] = await Promise.all([
    db.activity.findMany({ where: { userId, startDate: { gte: new Date(now.getTime() - 84 * 86400000), lte: now } } }),
    db.userProfile.findUnique({ where: { userId } }),
  ]);
  return baselineFromActivities(userId, activities, profile, now);
}
