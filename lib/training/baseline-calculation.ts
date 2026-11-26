import type { Activity, UserProfile } from "@prisma/client";
import { calculateVDOT, estimateSubmaximalVDOT } from "./vdot";

export interface AthleteBaseline {
  userId: string;
  totalActivitiesCount: number;
  runCount: number;
  fitnessSampleCount: number;
  averageWeeklyKm: number;
  peakWeeklyKm: number;
  longestRunKm: number;
  estimatedVdot: number;
  measuredMaxHr?: number;
  averageRunHr?: number;
  acwr: number; // Acute-to-Chronic Workload Ratio
  frequencyDaysPerWeek: number;
  hasSufficientData: boolean;
  /** Current level from the last four to eight weeks, used as the plan's individual starting point. */
  recent: RecentRunning;
}

export interface RecentRunning {
  /** Runs per week over the last four weeks. */
  runsPerWeek: number;
  weeklyKm: number;
  weeklyMinutes: number;
  /** Medians of the last up to six runs within eight weeks; 0 without runs. */
  typicalRunKm: number;
  typicalRunMinutes: number;
  typicalPaceSecPerKm: number;
  /** Average pace slower than 8:00 min/km usually means the runs contain walking breaks. */
  likelyRunWalk: boolean;
}

const NO_RECENT_RUNNING: RecentRunning = { runsPerWeek: 0, weeklyKm: 0, weeklyMinutes: 0, typicalRunKm: 0, typicalRunMinutes: 0, typicalPaceSecPerKm: 0, likelyRunWalk: false };
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function recentRunning(runs: FitnessActivity[], now: Date): RecentRunning {
  const valid = runs.filter(run => run.distance > 0 && run.movingTime >= 240 && run.movingTime / (run.distance / 1000) >= 150);
  const fourWeeks = valid.filter(run => run.startDate >= new Date(now.getTime() - 28 * 86400000));
  const typical = valid.filter(run => run.startDate >= new Date(now.getTime() - 56 * 86400000))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()).slice(0, 6);
  if (!typical.length && !fourWeeks.length) return NO_RECENT_RUNNING;
  const round = (value: number) => Math.round(value * 10) / 10;
  const pace = typical.length ? median(typical.map(run => run.movingTime / (run.distance / 1000))) : 0;
  return {
    runsPerWeek: round(fourWeeks.length / 4),
    weeklyKm: round(fourWeeks.reduce((sum, run) => sum + run.distance / 1000, 0) / 4),
    weeklyMinutes: Math.round(fourWeeks.reduce((sum, run) => sum + run.movingTime / 60, 0) / 4),
    typicalRunKm: typical.length ? round(median(typical.map(run => run.distance / 1000))) : 0,
    typicalRunMinutes: typical.length ? Math.round(median(typical.map(run => run.movingTime / 60))) : 0,
    typicalPaceSecPerKm: Math.round(pace),
    likelyRunWalk: pace > 480,
  };
}

export type FitnessActivity = Pick<Activity,
  'stravaId' | 'startDate' | 'sportType' | 'distance' | 'movingTime' | 'elapsedTime' |
  'totalElevationGain' | 'averageHeartrate' | 'maxHeartrate'
>;

export function baselineFromActivities(
  userId: string,
  source: FitnessActivity[],
  profile: Pick<UserProfile, "maxHeartrate" | "restingHeartrate"> | null,
  now: Date,
): AthleteBaseline {
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 86400000);
  const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 86400000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const activities = source.filter(a => a.startDate >= twelveWeeksAgo && a.startDate <= now);
  const runs = activities.filter(
    (a) => a.sportType === "Run" || a.sportType === "TrailRun" || a.sportType === "VirtualRun"
  );

  if (runs.length === 0) {
    return {
      userId,
      totalActivitiesCount: activities.length,
      runCount: 0,
      fitnessSampleCount: 0,
      averageWeeklyKm: 15.0, // Reasonable default for a beginner runner
      peakWeeklyKm: 20.0,
      longestRunKm: 6.0,
      estimatedVdot: 35.0,
      acwr: 1.0,
      frequencyDaysPerWeek: 2,
      hasSufficientData: false,
      recent: NO_RECENT_RUNNING,
    };
  }

  // Calculate volume per week (over the last 8 weeks)
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  const recentRuns = runs.filter((r) => new Date(r.startDate) >= eightWeeksAgo);

  const weeklyBuckets: { [weekIndex: number]: number } = {};
  for (let i = 0; i < 8; i++) weeklyBuckets[i] = 0;

  let longestRunMeters = 0;
  let maxHrRecorded = 0;
  let totalHrSum = 0;
  let hrCount = 0;
  let bestRaceVdot = 30;
  const submaximalVdots: number[] = [];
  let fitnessSampleCount = 0;

  // Pass 1: Find highest recorded HR across valid runs
  for (const run of runs) {
    if (run.maxHeartrate && run.maxHeartrate > maxHrRecorded && run.maxHeartrate < 230) {
      maxHrRecorded = Math.round(run.maxHeartrate);
    }
  }

  // Realistic fallback max HR if athlete has only recorded low/moderate efforts
  const effectiveMaxHr = profile?.maxHeartrate || maxHrRecorded || 185;
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
    // Historical callers and imported legacy rows can lack an external ID.
    const isHealthOnlyRun = typeof run.stravaId === "string" && run.stravaId.startsWith("health:");
    if (run.distance >= 3000 && run.movingTime > 0 && (!isHealthOnlyRun || Boolean(run.averageHeartrate))) {
      fitnessSampleCount++;
      // Health-only sessions contribute as HR-adjusted aerobic samples, never as maximal race efforts.
      if (!isHealthOnlyRun) {
        const raceV = calculateVDOT(run.distance, run.movingTime, run.totalElevationGain || 0);
        if (raceV > bestRaceVdot && raceV < 85) {
          bestRaceVdot = raceV;
        }
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
    fitnessSampleCount,
    averageWeeklyKm: Math.round(averageWeeklyKm * 10) / 10,
    peakWeeklyKm: Math.round(peakWeeklyKm * 10) / 10,
    longestRunKm: Math.round((longestRunMeters / 1000) * 10) / 10,
    estimatedVdot: Math.round(finalVdot * 10) / 10,
    measuredMaxHr: maxHrRecorded > 130 ? maxHrRecorded : undefined,
    averageRunHr: hrCount > 0 ? Math.round(totalHrSum / hrCount) : undefined,
    acwr: Number.isFinite(acwr) ? acwr : 0,
    frequencyDaysPerWeek: Math.min(Math.max(Math.round(recentRuns.length / 8), 1), 7),
    hasSufficientData: fitnessSampleCount >= 4,
    recent: recentRunning(runs, now),
  };
}
