import type { CaptureEvent, Territory } from './engine';

export type TerritoryData = {
  season: { key: string; start: string; end: string };
  myAreaM2: number;
  leaderboard: Array<{ userId: string; name: string; areaM2: number; count: number }>;
  territories: Array<Territory & { ownerName: string; mine: boolean; lastActivityName: string; history: Array<CaptureEvent & { fromName: string | null; toName: string }> }>;
  events: Array<CaptureEvent & { fromName: string | null; toName: string }>;
  myRuns: Array<{ id: string; stravaId: string; name: string; startDate: string; status: string; message: string; gainedM2: number }>;
};
