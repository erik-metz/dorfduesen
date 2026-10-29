import { dayKey, monthRange } from '@/lib/time';

export const TEAM_TARGET_KM = 1000;
export const TEAM_BADGE_PREFIX = 'MONTHLY_TEAM_1000_';

export function teamMonthLabel(monthKey: string) {
  return new Date(`${monthKey}-15T12:00:00Z`).toLocaleString('de-DE', {
    month: 'long', year: 'numeric', timeZone: 'Europe/Berlin',
  });
}

export interface TeamActivity {
  userId: string;
  distance: number;
  manualDistance: number | null;
  extractedDistance: number | null;
  movingTime: number;
  startDate: Date;
}

/** The display and awards use the same calendar, validity and corrected-distance rules. */
export function teamContributions(activities: TeamActivity[], reference: Date, now = new Date()) {
  const range = monthRange(reference);
  const contributions = new Map<string, number>();
  for (const activity of activities) {
    if (activity.startDate < range.start || activity.startDate >= range.end || activity.startDate > now || activity.movingTime <= 0) continue;
    const meters = activity.manualDistance ?? activity.extractedDistance ?? activity.distance;
    if (!Number.isFinite(meters) || meters <= 0) continue;
    contributions.set(activity.userId, (contributions.get(activity.userId) ?? 0) + meters);
  }
  return contributions;
}

export function buildTeamChallenge(contributions: Map<string, number>, now = new Date()) {
  const range = monthRange(now);
  const currentKm = [...contributions.values()].reduce((sum, meters) => sum + meters, 0) / 1000;
  const daysInMonth = new Date(range.end.getTime() - 1).getUTCDate();
  return {
    title: `Mission 1.000 km · ${teamMonthLabel(range.key)}`,
    description: 'Jeder Kilometer zählt: Gemeinsam durchs Ried. Wer aktiv Kilometer beiträgt, erhält bei Zielerreichung eine Trophäe für diesen Monat.',
    monthKey: range.key,
    monthLabel: teamMonthLabel(range.key),
    targetKm: TEAM_TARGET_KM,
    currentKm,
    percentage: Math.min(100, currentKm / TEAM_TARGET_KM * 100),
    isCompleted: currentKm >= TEAM_TARGET_KM,
    contributorCount: contributions.size,
    daysRemaining: Math.max(0, daysInMonth - Number(dayKey(now).slice(-2))),
  };
}
