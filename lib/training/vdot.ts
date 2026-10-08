/**
 * Jack Daniels VDOT and Running Pace Calculator
 * Reference: Daniels' Running Formula
 */

export interface TrainingPaces {
  easyMin: string;       // e.g. "5:45"
  easyMax: string;       // e.g. "6:15"
  marathonMin: string;   // e.g. "5:15"
  marathonMax: string;   // e.g. "5:25"
  thresholdMin: string;  // e.g. "4:45"
  thresholdMax: string;  // e.g. "4:55"
  intervalMin: string;   // e.g. "4:15"
  intervalMax: string;   // e.g. "4:25"
  repetitionMin: string; // e.g. "3:55"
  repetitionMax: string; // e.g. "4:05"
}

export interface PredictedTimes {
  fiveKmSeconds: number;
  tenKmSeconds: number;
  halfMarathonSeconds: number;
  marathonSeconds: number;
}

/**
 * Calculates Oxygen cost (ml/kg/min) for a given flat velocity in m/min.
 * Jack Daniels formula: VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
 */
export function calculateVo2FromVelocity(velocityMetersPerMin: number): number {
  if (velocityMetersPerMin <= 0) return 0;
  return -4.60 + 0.182258 * velocityMetersPerMin + 0.000104 * Math.pow(velocityMetersPerMin, 2);
}

/**
 * Calculates Gradient Adjusted Pace (GAP) velocity in m/min.
 * Based on Minetti et al. (2002) energy cost of uphill running.
 * Each 1% gradient (+10m per 1000m) costs ~3.3% additional metabolic effort.
 */
export function calculateGAPVelocity(
  rawVelocityMetersPerMin: number,
  elevationGainMeters: number,
  distanceMeters: number
): number {
  if (distanceMeters <= 0 || elevationGainMeters <= 0) return rawVelocityMetersPerMin;
  const gradient = elevationGainMeters / distanceMeters;
  // Cap incline multiplier at 1.4x (+40%) to prevent GPS noise distortion
  const multiplier = Math.min(1 + gradient * 3.3, 1.4);
  return rawVelocityMetersPerMin * multiplier;
}

/**
 * Estimates VDOT from a submaximal training run where heart rate and elevation are recorded.
 * Uses Swain/Karvonen %VO2max approximation relative to %HRmax / HRR.
 */
export function estimateSubmaximalVDOT(
  distanceMeters: number,
  timeSeconds: number,
  elevationGainMeters: number,
  averageHeartrate: number,
  maxHeartrate: number,
  restingHeartrate?: number
): number | null {
  if (distanceMeters <= 0 || timeSeconds <= 0) return null;
  const paceSecondsPerKm = timeSeconds / (distanceMeters / 1000);

  // Plausibility check: Running pace between 2:40 and 10:00 min/km, and at least 8 minutes
  if (paceSecondsPerKm < 160 || paceSecondsPerKm > 600 || timeSeconds < 480) {
    return null;
  }

  // Plausibility check: HR between 100 and maxHeartrate + 10
  if (averageHeartrate < 100 || averageHeartrate > maxHeartrate + 10) {
    return null;
  }

  const rawVelocity = distanceMeters / (timeSeconds / 60);
  const gapVelocity = calculateGAPVelocity(rawVelocity, elevationGainMeters, distanceMeters);
  const vo2AtPace = calculateVo2FromVelocity(gapVelocity);
  if (vo2AtPace <= 0) return null;

  let percentVo2Max: number;
  if (restingHeartrate && restingHeartrate < averageHeartrate && restingHeartrate < maxHeartrate - 40) {
    // Heart Rate Reserve (Karvonen): %HRR ≈ %VO2max
    const hrr = (averageHeartrate - restingHeartrate) / (maxHeartrate - restingHeartrate);
    percentVo2Max = Math.max(0.45, Math.min(1.0, hrr));
  } else {
    // Swain et al. (1994): %VO2max = (%HRmax - 0.37) / 0.64
    const percentHrMax = averageHeartrate / maxHeartrate;
    percentVo2Max = Math.max(0.45, Math.min(1.0, (percentHrMax - 0.37) / 0.64));
  }

  const estimatedVdot = vo2AtPace / percentVo2Max;
  // Realistic athlete bounds
  if (estimatedVdot < 25 || estimatedVdot > 85) return null;
  return Math.round(estimatedVdot * 10) / 10;
}

/**
 * Calculates VDOT from race distance in meters and time in seconds.
 * Using Jack Daniels approximation formulas with optional gradient adjustment.
 */
export function calculateVDOT(
  distanceMeters: number,
  timeSeconds: number,
  elevationGainMeters: number = 0
): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 30;

  const timeMinutes = timeSeconds / 60;
  // Velocity in meters per minute (GAP-adjusted if elevation present)
  const rawV = distanceMeters / timeMinutes;
  const v = calculateGAPVelocity(rawV, elevationGainMeters, distanceMeters);

  // Oxygen cost formula: VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
  const vo2 = calculateVo2FromVelocity(v);

  // Percent of VO2max sustainable formula based on duration
  const percentMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  const vdot = vo2 / percentMax;
  return Math.min(Math.max(Math.round(vdot * 10) / 10, 25), 85);
}

/**
 * Converts velocity (m/min) to pace format "MM:SS" (min/km).
 */
export function velocityToPace(velocityMetersPerMin: number): string {
  if (velocityMetersPerMin <= 0) return "6:00";
  const secondsPerKm = (1000 / velocityMetersPerMin) * 60;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Converts pace "MM:SS" to seconds per km
 */
export function paceToSecondsPerKm(pace: string): number {
  const [min, sec] = pace.split(":").map(Number);
  return (min || 0) * 60 + (sec || 0);
}

/**
 * Calculates target training paces for a given VDOT.
 */
export function getTrainingPaces(vdot: number): TrainingPaces {
  // Approximate velocity for VO2max: solve VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2 for v
  // Quadratic equation: 0.000104 * v^2 + 0.182258 * v - (4.60 + vdot) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.60 + vdot);
  const vMax = (-b + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);

  // Daniels standard intensities (% of VO2max velocity):
  // Easy: 65% - 74%
  // Marathon: 75% - 84%
  // Threshold (Tempo): 85% - 88%
  // Interval: 95% - 100%
  // Repetition: 105% - 110%
  const easyMinV = vMax * 0.74;
  const easyMaxV = vMax * 0.65;

  const marathonMinV = vMax * 0.84;
  const marathonMaxV = vMax * 0.78;

  const thresholdMinV = vMax * 0.89;
  const thresholdMaxV = vMax * 0.85;

  const intervalMinV = vMax * 1.00;
  const intervalMaxV = vMax * 0.95;

  const repetitionMinV = vMax * 1.10;
  const repetitionMaxV = vMax * 1.05;

  return {
    easyMin: velocityToPace(easyMinV),
    easyMax: velocityToPace(easyMaxV),
    marathonMin: velocityToPace(marathonMinV),
    marathonMax: velocityToPace(marathonMaxV),
    thresholdMin: velocityToPace(thresholdMinV),
    thresholdMax: velocityToPace(thresholdMaxV),
    intervalMin: velocityToPace(intervalMinV),
    intervalMax: velocityToPace(intervalMaxV),
    repetitionMin: velocityToPace(repetitionMinV),
    repetitionMax: velocityToPace(repetitionMaxV),
  };
}

/**
 * Predicts race finish times from VDOT.
 */
export function predictRaceTimes(vdot: number): PredictedTimes {
  // Solve for time given distance and vdot iteratively or with approximation
  function getTimeForDistance(distanceMeters: number): number {
    let low = 600; // 10 min
    let high = 86400; // 24 hours
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      const calculatedVdot = calculateVDOT(distanceMeters, mid);
      if (calculatedVdot < vdot) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return Math.round((low + high) / 2);
  }

  return {
    fiveKmSeconds: getTimeForDistance(5000),
    tenKmSeconds: getTimeForDistance(10000),
    halfMarathonSeconds: getTimeForDistance(21097),
    marathonSeconds: getTimeForDistance(42195),
  };
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
