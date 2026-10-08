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
 * Calculates VDOT from race distance in meters and time in seconds.
 * Using Jack Daniels approximation formulas.
 */
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 30;

  const timeMinutes = timeSeconds / 60;
  // Velocity in meters per minute
  const v = distanceMeters / timeMinutes;

  // Oxygen cost formula: VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * Math.pow(v, 2);

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
