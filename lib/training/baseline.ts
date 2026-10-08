import { db } from "@/lib/db";
import { calculateVDOT, estimateSubmaximalVDOT } from "./vdot";

export interface AthleteBaseline {
  userId: string;
  totalActivitiesCount: number;
  runCount: number;
  averageWeeklyKm: number;
  peakWeeklyKm: number;
  longestRunKm: number;
  estimatedVdot: number;
  measuredMaxHr?: number;
  averageRunHr?: number;
  acwr: number; // Acute-to-Chronic Workload Ratio
  frequencyDaysPerWeek: number;
  hasSufficientData: boolean;
}

/**
 * Analyzes the user's historical Strava activities from the database
 * to construct a solid physiological baseline for training plan generation.
 * Takes into account:
 * - Distance & Moving Time
 * - Elevation gain (Gradient Adjusted Pace)
 * - Heart rate decoupling (%HRmax / HRR vs pace)
 */
export async function calculateAthleteBaseline(userId: string): Promise<AthleteBaseline> {
  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [activities, profile] = await Promise.all([
    db.activity.findMany({
      where: {
        userId,
        startDate: { gte: twelveWeeksAgo },
      },
      orderBy: { startDate: "desc" },
    }),
    db.userProfile.findUnique({
      where: { userId },
    }),
  ]);

  const runs = activities.filter(
    (a) => a.sportType === "Run" || a.sportType === "TrailRun" || a.sportType === "VirtualRun"
  );

  if (runs.length === 0) {
    return {
      userId,
      totalActivitiesCount: activities.length,
      runCount: 0,
      averageWeeklyKm: 15.0, // Reasonable default for a beginner runner
      peakWeeklyKm: 20.0,
      longestRunKm: 6.0,
      estimatedVdot: profile?.vdotScore || 35.0,
      acwr: 1.0,
      frequencyDaysPerWeek: 2,
      hasSufficientData: false,
    };
  }

  // Calculate volume per week (over the last 8 weeks)
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  const recentRuns = runs.filter((r) => new Date(r.startDate) >= eightWeeksAgo);

  const weeklyBuckets: { [weekIndex: number]: number } = {};
  for (let i = 0; i < 8; i++) weeklyBuckets[i] = 0;

  let longestRunMeters = 0;
  let maxHrRecorded = profile?.maxHeartrate || 0;
  let totalHrSum = 0;
  let hrCount = 0;
  let bestRaceVdot = 30;
  const submaximalVdots: number[] = [];

  // Pass 1: Find highest recorded HR across valid runs
  for (const run of runs) {
    if (run.maxHeartrate && run.maxHeartrate > maxHrRecorded && run.maxHeartrate < 230) {
      maxHrRecorded = Math.round(run.maxHeartrate);
    }
  }

  // Realistic fallback max HR if athlete has only recorded low/moderate efforts
  const effectiveMaxHr = Math.max(maxHrRecorded, 185);
  const restingHr = profile?.restingHeartrate || undefined;

  // Pass 2: Evaluate activities
  for (const run of runs) {
    const paceSecondsPerKm = run.distance > 0 ? run.movingTime / (run.distance / 1000) : 0;
    
    // Ignore corrupted runs (e.g. pace < 2:30 min/km GPS glitch or moving time < 4 minutes)
    if (paceSecondsPerKm < 150 || run.movingTime < 240) {
      continue;
    }

    if (run.distance > longestRunMeters) {
      longestRunMeters = run.distance;
    }

    if (run.averageHeartrate && run.averageHeartrate > 80 && run.averageHeartrate < 220) {
      totalHrSum += run.averageHeartrate;
      hrCount++;
    }

    // Estimate VDOT if run is >= 3km and moving time > 0
    if (run.distance >= 3000 && run.movingTime > 0) {
      // 1. Race VDOT (assumes maximal effort, adjusted for elevation / GAP)
      const raceV = calculateVDOT(run.distance, run.movingTime, run.totalElevationGain || 0);
      if (raceV > bestRaceVdot && raceV < 85) {
        bestRaceVdot = raceV;
      }

      // 2. Submaximal HR-adjusted VDOT (considers heart rate reserve vs running speed & elevation)
      if (run.averageHeartrate) {
        const hrV = estimateSubmaximalVDOT(
          run.distance,
          run.movingTime,
          run.totalElevationGain || 0,
          run.averageHeartrate,
          effectiveMaxHr,
          restingHr
        );
        if (hrV !== null && hrV >= 25 && hrV <= 85) {
          submaximalVdots.push(hrV);
        }
      }
    }
  }

  // Determine final physiological VDOT
  let finalVdot = bestRaceVdot;
  if (submaximalVdots.length > 0) {
    submaximalVdots.sort((a, b) => b - a);
    // Take top 35% average of submaximal HR estimates to get a robust, high-quality aerobic baseline
    const sampleSize = Math.max(Math.ceil(submaximalVdots.length * 0.35), 1);
    const topSlice = submaximalVdots.slice(0, sampleSize);
    const avgSubVdot = topSlice.reduce((sum, val) => sum + val, 0) / sampleSize;
    
    // Choose the higher of verified race VDOT or HR-derived aerobic VDOT
    finalVdot = Math.max(bestRaceVdot, Math.round(avgSubVdot * 10) / 10);
  }

  for (const run of recentRuns) {
    const runDate = new Date(run.startDate);
    const diffWeeks = Math.floor(
      (now.getTime() - runDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (diffWeeks >= 0 && diffWeeks < 8) {
      weeklyBuckets[diffWeeks] = (weeklyBuckets[diffWeeks] || 0) + run.distance / 1000;
    }
  }

  const weeklyKmValues = Object.values(weeklyBuckets);
  const averageWeeklyKm =
    weeklyKmValues.reduce((a, b) => a + b, 0) / Math.max(weeklyKmValues.length, 1);
  const peakWeeklyKm = Math.max(...weeklyKmValues, 0);

  // Acute (last 7 days) vs Chronic (last 28 days average per week)
  const acuteDistance = runs
    .filter((r) => new Date(r.startDate) >= oneWeekAgo)
    .reduce((sum, r) => sum + r.distance / 1000, 0);

  const chronicDistanceFourWeeks = runs
    .filter((r) => new Date(r.startDate) >= fourWeeksAgo)
    .reduce((sum, r) => sum + r.distance / 1000, 0);

  const chronicWeeklyAvg = (chronicDistanceFourWeeks / 4) || 1;
  const acwr = Math.round((acuteDistance / chronicWeeklyAvg) * 100) / 100;

  return {
    userId,
    totalActivitiesCount: activities.length,
    runCount: runs.length,
    averageWeeklyKm: Math.max(Math.round(averageWeeklyKm * 10) / 10, 5),
    peakWeeklyKm: Math.round(peakWeeklyKm * 10) / 10,
    longestRunKm: Math.round((longestRunMeters / 1000) * 10) / 10,
    estimatedVdot: Math.round(finalVdot * 10) / 10,
    measuredMaxHr: maxHrRecorded > 130 ? maxHrRecorded : undefined,
    averageRunHr: hrCount > 0 ? Math.round(totalHrSum / hrCount) : undefined,
    acwr: isFinite(acwr) && acwr > 0 ? acwr : 1.0,
    frequencyDaysPerWeek: Math.min(Math.max(Math.round(runs.length / 8), 1), 7),
    hasSufficientData: runs.length >= 4,
  };
}
