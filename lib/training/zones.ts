/**
 * Heart Rate Zones and Physiological Estimations
 */

export interface HeartRateZone {
  zone: number;
  name: string;
  minHr: number;
  maxHr: number;
  description: string;
}

export interface UserHeartRateProfile {
  maxHr: number;
  restingHr?: number;
  isEstimated: boolean;
  zones: HeartRateZone[];
}

/**
 * Tanaka Formula for age-predicted maximum heart rate:
 * HRmax = 208 - 0.7 * Age
 */
export function estimateMaxHeartRate(age: number): number {
  if (age <= 0) return 185;
  return Math.round(208 - 0.7 * age);
}

/**
 * Calculates 5 standard training zones.
 * If restingHr is available, uses Karvonen formula (Heart Rate Reserve - HRR).
 * Otherwise uses direct % HRmax.
 */
export function calculateHeartRateZones(maxHr: number, restingHr?: number): HeartRateZone[] {
  const useKarvonen = typeof restingHr === "number" && restingHr > 35 && restingHr < maxHr;
  const hrr = useKarvonen ? maxHr - (restingHr as number) : 0;

  function getZoneBounds(pctLow: number, pctHigh: number): { min: number; max: number } {
    if (useKarvonen) {
      const min = Math.round((restingHr as number) + hrr * pctLow);
      const max = Math.round((restingHr as number) + hrr * pctHigh);
      return { min, max };
    }
    const min = Math.round(maxHr * pctLow);
    const max = Math.round(maxHr * pctHigh);
    return { min, max };
  }

  const z1 = getZoneBounds(0.50, 0.60);
  const z2 = getZoneBounds(0.60, 0.70);
  const z3 = getZoneBounds(0.70, 0.80);
  const z4 = getZoneBounds(0.80, 0.90);
  const z5 = getZoneBounds(0.90, 1.00);

  return [
    {
      zone: 1,
      name: "Regeneration / Active Recovery",
      minHr: z1.min,
      maxHr: z1.max,
      description: "Sehr locker. Fördert Durchblutung und aktive Erholung.",
    },
    {
      zone: 2,
      name: "Grundlagenausdauer I (Aerob)",
      minHr: z2.min,
      maxHr: z2.max,
      description: "Fettverbrennung, Mitochondriendichte. Fundament für Ausdauer (80% des Plans).",
    },
    {
      zone: 3,
      name: "Grundlagenausdauer II / Marathon-Tempo",
      minHr: z3.min,
      maxHr: z3.max,
      description: "Zügiges Wohlfühltempo, aerobe Kapazität.",
    },
    {
      zone: 4,
      name: "Laktatschwelle (Threshold)",
      minHr: z4.min,
      maxHr: z4.max,
      description: "Schwellenbereich. Verbessert Laktatabbau und anaerobe Schwelle.",
    },
    {
      zone: 5,
      name: "VO2max / Maximale Belastung",
      minHr: z5.min,
      maxHr: z5.max,
      description: "Kurze harte Intervalle. Sauerstoffaufnahmekapazität und Schnelligkeit.",
    },
  ];
}
