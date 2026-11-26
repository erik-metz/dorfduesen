import type { CaptureEvent, Territory } from './engine';

type PresentedEvent = CaptureEvent & { fromName: string | null; toName: string };
export type TerritoryData = {
  season: { key: string; start: string; end: string };
  myAreaM2: number;
  leaderboard: Array<{ userId: string; name: string; areaM2: number; count: number }>;
  territories: Array<Territory & { ownerName: string; ownerNames: string[]; mine: boolean; lastActivityName: string; history: PresentedEvent[] }>;
  /** Per-territory ledger, kept for older app versions. New clients render `changes`. */
  events: PresentedEvent[];
  /** One entry per run or group run, newest first. */
  changes: Array<{ id: string; at: string; runnerNames: string[]; freeM2: number; capturedM2: number; fromNames: string[] }>;
  myRuns: Array<{ id: string; stravaId: string; name: string; startDate: string; status: string; message: string; gainedM2: number; groupSize: number }>;
};

/** Small areas in m², larger ones in km² with two decimals, German number format. */
export function formatArea(m2: number) {
  if (m2 < 10000) return `${String(Math.round(m2)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} m²`;
  return `${(m2 / 1e6).toFixed(2).replace('.', ',')} km²`;
}

const nameList = (names: string[]) => names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(' und ');
/** One readable line per run or group run. Mirrored in apps/mobile/src/territoryFormat.ts. */
export function describeChange(change: TerritoryData['changes'][number]) {
  const date = new Date(change.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  if (change.runnerNames.length > 1) {
    return `${date} · Gruppenlauf mit ${change.runnerNames.length} Läufern (${nameList(change.runnerNames)}) · ${formatArea(change.freeM2 + change.capturedM2)}${change.fromNames.length ? ` · erobert von ${nameList(change.fromNames)}` : ''}`;
  }
  const runner = change.runnerNames[0] ?? 'DorfDüse';
  if (change.capturedM2 >= 1) return `${date} · ${runner} erobert ${formatArea(change.capturedM2)} von ${nameList(change.fromNames)}${change.freeM2 >= 1 ? ` · ${formatArea(change.freeM2)} frei dazu` : ''}`;
  return `${date} · ${runner} nimmt ${formatArea(change.freeM2)} freie Fläche ein`;
}
