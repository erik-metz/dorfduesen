import { area } from '@turf/area';
import { distance } from '@turf/distance';
import { union } from 'polyclip-ts';
import { difference } from '@turf/difference';
import { buffer } from '@turf/buffer';
import { feature, featureCollection, polygon } from '@turf/helpers';
import type { Polygon, MultiPolygon, Position } from 'geojson';

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
    const faces = union([ring]).filter(coordinates => {
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

/** Deterministic ledger replay: import order, retries and concurrent jobs cannot change ownership. */
export function replayClaims(input: Claim[]) {
  const territories: Territory[] = [];
  const events: CaptureEvent[] = [];
  const results: ClaimResult[] = [];
  const seen = new Set<string>();
  const boxes = new Map<string, number[]>();
  for (const claim of [...input].sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.id.localeCompare(b.id))) {
    if (seen.has(claim.id)) continue;
    seen.add(claim.id);
    const candidate = feature(claim.geometry);
    const tolerant = buffer(candidate, 10, { units: 'meters' });
    const candidateBox = bounds(claim.geometry);
    const tolerantBox = tolerant ? bounds(tolerant.geometry) : candidateBox;
    let gainedM2 = 0;
    let capturedCount = 0;
    for (const target of territories) {
      if (target.userId === claim.userId || !tolerant || !intersects(tolerantBox, boxes.get(target.id)!)) continue;
      const outside = difference(featureCollection([feature(target.geometry), tolerant]));
      if (outside && area(outside) > 1) continue;
      events.push({ claimId: claim.id, territoryId: target.id, fromUserId: target.userId, toUserId: claim.userId, areaM2: target.areaM2, at: claim.endedAt });
      target.userId = claim.userId;
      target.lastClaimId = claim.id;
      target.capturedAt = claim.endedAt;
      gainedM2 += target.areaM2;
      capturedCount++;
    }
    // Existing borders stay intact, including partially intersected foreign territories.
    const overlaps = territories.filter(t => intersects(candidateBox, boxes.get(t.id)!));
    const free = overlaps.length
      ? difference(featureCollection([candidate, ...overlaps.map(t => feature(t.geometry))]))
      : candidate;
    if (free) {
      const pieces = free.geometry.type === 'Polygon' ? [free.geometry.coordinates] : free.geometry.coordinates;
      pieces.forEach((coordinates, index) => {
        const geometry: Polygon = { type: 'Polygon', coordinates };
        const areaM2 = area(geometry);
        if (areaM2 < 100) return; // Discard GPS slivers, never count them twice.
        const id = `${claim.id}:${index}`;
        boxes.set(id, bounds(geometry));
        territories.push({ id, geometry, userId: claim.userId, originClaimId: claim.id, lastClaimId: claim.id, areaM2, capturedAt: claim.endedAt });
        events.push({ claimId: claim.id, territoryId: id, fromUserId: null, toUserId: claim.userId, areaM2, at: claim.endedAt });
        gainedM2 += areaM2;
      });
    }
    results.push({ claimId: claim.id, gainedM2, capturedCount });
  }
  return { territories, events, results };
}

export function seasonRange(enabledAt: Date, now = new Date()) {
  const quarter = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = new Date(Math.max(enabledAt.getTime(), Date.UTC(now.getUTCFullYear(), quarter, 1)));
  const end = new Date(Date.UTC(now.getUTCFullYear(), quarter + 3, 1));
  return { start, end, key: `${now.getUTCFullYear()}-Q${quarter / 3 + 1}` };
}
