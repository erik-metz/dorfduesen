import type { RunWalkSession } from './run-walk';

export type WeekOutcome = 'ON_TRACK' | 'REPEAT' | 'STEP_BACK';

export interface WeekReview {
  plannedSessions: number;
  plannedKm: number;
  /** Runs of at least one kilometre inside the reviewed week. */
  completedSessions: number;
  actualKm: number;
}

/**
 * Deterministic weekly review. The plan only moves forward when the athlete actually did
 * most of the week; otherwise the level is repeated, or reduced after an almost empty week.
 * It never advances faster than planned: more volume than planned is not a reason to add load.
 */
export function reviewWeek(review: WeekReview): { outcome: WeekOutcome; sessionShare: number; volumeShare: number } {
  if (review.plannedSessions <= 0) return { outcome: 'ON_TRACK', sessionShare: 1, volumeShare: 1 };
  const sessionShare = Math.min(review.completedSessions / review.plannedSessions, 1);
  const volumeShare = review.plannedKm > 0 ? review.actualKm / review.plannedKm : 1;
  const outcome: WeekOutcome = sessionShare < 0.5 && volumeShare < 0.35 ? 'STEP_BACK'
    : sessionShare < 0.6 || volumeShare < 0.75 ? 'REPEAT'
    : 'ON_TRACK';
  return { outcome, sessionShare, volumeShare };
}

export function storedRunWalk(value: unknown): RunWalkSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const session = value as Record<string, unknown>;
  if (session.type !== 'RUN_WALK') return null;
  const numbers = ['warmupWalkMinutes', 'repeats', 'runMinutes', 'walkMinutes', 'cooldownWalkMinutes'];
  if (!numbers.every(key => typeof session[key] === 'number' && Number.isFinite(session[key]))) return null;
  return session as unknown as RunWalkSession;
}

export function adaptationMessage(outcome: WeekOutcome, review: WeekReview) {
  const done = `${review.completedSessions} von ${review.plannedSessions} Läufen, ${Math.round(review.actualKm * 10) / 10} von ${Math.round(review.plannedKm * 10) / 10} km`;
  return outcome === 'STEP_BACK'
    ? `Letzte Woche war kaum Training drin (${done}). Kein Stress: Wir gehen eine Stufe zurück und bauen von dort neu auf.`
    : `Letzte Woche lief nicht alles nach Plan (${done}). Diese Woche wiederholst du deshalb das gleiche Level, die restlichen Wochen bis zum Ziel sind neu verteilt.`;
}
