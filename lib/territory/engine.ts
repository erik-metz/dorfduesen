import { replayBudget } from './budget';
import { area } from '@turf/area';
import { distance } from '@turf/distance';
import { normalizeShape, subtractShape } from './clipping';
import { simplify } from '@turf/simplify';
import { buffer } from '@turf/buffer';
import { feature, polygon } from '@turf/helpers';
import type { Polygon, MultiPolygon } from 'geojson';

export const RULES_VERSION = 2;
export type Shape = Polygon | MultiPolygon;
export const reasons = {
  NO_GPS: 'Keine vollständige GPS-Strecke verfügbar.',
  OPEN: 'Start und Ziel liegen zu weit auseinander (100 m Grundtoleranz, bis 10 % der Strecke, maximal 300 m).',
  INVALID: 'GPS-Strecke ist unvollständig oder enthält unplausible Sprünge.',
  CROSSED: 'Aus dieser Strecke konnte bisher keine geschlossene Fläche erkannt werden. Eine erneute Prüfung berücksichtigt Kreuzungen.',
  SMALL: 'Die Runde umschließt weniger als einen Hektar (10.000 m²).',
  SPORT: 'Nur Outdoor-Läufe und Trailruns zählen.',
  OLD: 'Der Lauf liegt außerhalb der aktiven Saison.',
  PRIVATE: 'Manuelle, Indoor- oder private Aktivitäten zählen nicht.',
} as const;
export type Reason = keyof typeof reasons;
export type Evaluation = { geometry: Shape; reason: null } | { geometry: null; reason: Reason };

/** Input is the full latlng stream, never the diagram's downsampled stream. */
export function evaluateLoop(points: number[][], times: number[], reportedDistance: number): Evaluation {
  const invalid = (): Evaluation => ({ geometry: null, reason: 'INVALID' });
  if (!Array.isArray(points) || !Array.isArray(times)) return invalid();
  if (points.length < 4) return { geometry: null, reason: 'NO_GPS' };
  if (points.length > 30000 || times.length !== points.length || !Number.isFinite(reportedDistance) || reportedDistance <= 0) return invalid();
  const ring: [number, number][] = [];
  let measured = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 85 || Math.abs(p[1]) > 180 || !Number.isFinite(times[i]) || times[i] < 0) return invalid();
    if (i) {
      const delta = times[i] - times[i - 1];
      const meters = distance([points[i - 1][1], points[i - 1][0]], [p[1], p[0]], { units: 'meters' });
      // Never close a recording gap or accept vehicle-speed jumps as a boundary.
      if (delta <= 0 || meters > 200 || meters / delta > 12) return invalid();
      measured += meters;
    }
    if (!ring.length || ring[ring.length - 1][0] !== p[1] || ring[ring.length - 1][1] !== p[0]) ring.push([p[1], p[0]]);
  }
  if (measured < reportedDistance * 0.75 || measured > reportedDistance * 1.25 || ring.length < 4) return invalid();
  const gap = distance(ring[0], ring[ring.length - 1], { units: 'meters' });
  if (gap > Math.min(300, Math.max(100, measured * 0.10))) return { geometry: null, reason: 'OPEN' };
  if (gap > 0) ring.push([...ring[0]]);
  if (Math.max(...ring.map(p => p[0])) - Math.min(...ring.map(p => p[0])) > 180) return invalid();
  try {
    // Normalize the actual boundary, including repeated access paths and crossed loops.
    // Non-zero winding retains enclosed faces; it never invents a convex hull.
    const normalized = normalizeShape({ type: 'Polygon', coordinates: [ring] });
    const faces = (normalized ? normalized.type === 'Polygon' ? [normalized.coordinates] : normalized.coordinates : []).filter(coordinates => {
      const face = polygon(coordinates);
      if (area(face) < 10000) return false;
      // A narrow GPS ribbon along an out-and-back track is not a real enclosed plot.
      const interior = buffer(face, -15, { units: 'meters' });
      return interior && area(interior) >= 100;
    });
    if (!faces.length) return { geometry: null, reason: 'SMALL' };
    const geometry: Shape = faces.length === 1
      ? { type: 'Polygon', coordinates: faces[0] }
      : { type: 'MultiPolygon', coordinates: faces };
    return { geometry, reason: null };
  } catch {
    return invalid();
  }
}

export type Claim = { id: string; userId: string; endedAt: string; geometry: Shape };
export type Territory = { id: string; userId: string; originClaimId: string; lastClaimId: string; geometry: Shape; areaM2: number; capturedAt: string };
export type CaptureEvent = { claimId: string; territoryId: string; fromUserId: string | null; toUserId: string; areaM2: number; at: string };
export type ClaimResult = { claimId: string; gainedM2: number; capturedCount: number };

function bounds(shape: Shape): number[] {
  const polygons = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rings of polygons) for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}
function intersects(a: number[], b: number[]) { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }

/** Keep the full claim for audit; bound clipping work with a 5m boundary tolerance. */
function replayShape(shape: Shape): Shape {
  const polygons = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
  const latitude = polygons[0][0][0][1] * Math.PI / 180;
  const mx = 111195 * Math.cos(latitude), my = 111195;
  const projected: MultiPolygon = { type: 'MultiPolygon', coordinates: polygons.map(rings =>
    rings.map(ring => ring.map(([x, y]) => [x * mx, y * my]))) };
  const reduced = simplify(projected, { tolerance: 5, highQuality: true });
  const coordinates = reduced.coordinates.map(rings => rings.map(ring => ring.map(([x, y]) =>
    [Number((x / mx).toFixed(12)), Number((y / my).toFixed(12))])));
  // Simplification can introduce touching segments; normalize them before clipping.
  return normalizeShape({ type: 'MultiPolygon', coordinates }) ?? shape;
}

const GRID_CELL_DEGREES = 0.01;
const GRID_MAX_CELLS = 512;

function gridCells(box: number[]) {
  const minX = Math.floor(box[0] / GRID_CELL_DEGREES);
  const minY = Math.floor(box[1] / GRID_CELL_DEGREES);
  const maxX = Math.floor(box[2] / GRID_CELL_DEGREES);
  const maxY = Math.floor(box[3] / GRID_CELL_DEGREES);
  const count = (maxX - minX + 1) * (maxY - minY + 1);
  if (!Number.isSafeInteger(count) || count <= 0 || count > GRID_MAX_CELLS) return null;
  const cells: string[] = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) cells.push(`${x}:${y}`);
  return cells;
}

/** Broad phase only: exact geometry checks still decide every overlap and capture. */
class TerritorySpatialIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly wide = new Set<number>();

  add(index: number, box: number[]) {
    const keys = gridCells(box);
    if (!keys) { this.wide.add(index); return; }
    for (const key of keys) {
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(index);
      else this.cells.set(key, [index]);
    }
  }

  candidates(box: number[]) {
    const keys = gridCells(box);
    if (!keys) return null;
    const result = new Set(this.wide);
    for (const key of keys) for (const index of this.cells.get(key) ?? []) result.add(index);
    return [...result].sort((a, b) => a - b);
  }
}

/** Deterministic ledger replay: import order, retries and concurrent jobs cannot change ownership. */
export function replayClaims(input: Claim[], options: { budgetMs?: number } = {}) {
  const checkBudget = options.budgetMs === undefined ? () => {} : replayBudget(options.budgetMs);
  checkBudget();
  const territories: Territory[] = [];
  const events: CaptureEvent[] = [];
  const results: ClaimResult[] = [];
  const seen = new Set<string>();
  const boxes = new Map<string, number[]>();
  const spatialIndex = new TerritorySpatialIndex();
  for (const claim of [...input].sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.id.localeCompare(b.id))) {
    checkBudget();
    if (seen.has(claim.id)) continue;
    seen.add(claim.id);
    const geometry = replayShape(claim.geometry);
    const candidate = feature(geometry);
    checkBudget();
    const tolerant = buffer(candidate, 10, { units: 'meters' });
    const candidateBox = bounds(geometry);
    const tolerantBox = tolerant ? bounds(tolerant.geometry) : candidateBox;
    let gainedM2 = 0;
    let capturedCount = 0;
    const captureCandidates = spatialIndex.candidates(tolerantBox) ?? territories.map((_, index) => index);
    for (const targetIndex of captureCandidates) {
      checkBudget();
      const target = territories[targetIndex];
      if (!target || target.userId === claim.userId || !tolerant || !intersects(tolerantBox, boxes.get(target.id)!)) continue;
      const outside = subtractShape(target.geometry, [tolerant.geometry]);
      if (outside && area(outside) > 1) continue;
      events.push({ claimId: claim.id, territoryId: target.id, fromUserId: target.userId, toUserId: claim.userId, areaM2: target.areaM2, at: claim.endedAt });
      target.userId = claim.userId;
      target.lastClaimId = claim.id;
      target.capturedAt = claim.endedAt;
      gainedM2 += target.areaM2;
      capturedCount++;
    }
    // Existing borders stay intact, including partially intersected foreign territories.
    const overlapCandidates = spatialIndex.candidates(candidateBox) ?? territories.map((_, index) => index);
    const overlaps = overlapCandidates.map(index => territories[index]).filter(t => t && intersects(candidateBox, boxes.get(t.id)!));
    const free = overlaps.length
      ? subtractShape(geometry, overlaps.map(t => t.geometry))
      : geometry;
    checkBudget();
    if (free) {
      const pieces = free.type === 'Polygon' ? [free.coordinates] : free.coordinates;
      pieces.forEach((coordinates, index) => {
        const geometry: Polygon = { type: 'Polygon', coordinates };
        const areaM2 = area(geometry);
        if (areaM2 < 100) return; // Discard GPS slivers, never count them twice.
        const id = `${claim.id}:${index}`;
        boxes.set(id, bounds(geometry));
        territories.push({ id, geometry, userId: claim.userId, originClaimId: claim.id, lastClaimId: claim.id, areaM2, capturedAt: claim.endedAt });
        spatialIndex.add(territories.length - 1, boxes.get(id)!);
        events.push({ claimId: claim.id, territoryId: id, fromUserId: null, toUserId: claim.userId, areaM2, at: claim.endedAt });
        gainedM2 += areaM2;
      });
    }
    results.push({ claimId: claim.id, gainedM2, capturedCount });
  }
  checkBudget();
  return { territories, events, results };
}

export function seasonRange(enabledAt: Date, now = new Date()) {
  const quarter = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = new Date(Math.max(enabledAt.getTime(), Date.UTC(now.getUTCFullYear(), quarter, 1)));
  const end = new Date(Date.UTC(now.getUTCFullYear(), quarter + 3, 1));
  return { start, end, key: `${now.getUTCFullYear()}-Q${quarter / 3 + 1}` };
}
