import * as ClipperLib from 'clipper-lib';
import type { Shape } from './engine';

/** Millimetre integer coordinates avoid failures at nearly coincident GPS borders. */
function clip(subject: Shape, subtract: Shape[]): Shape | null {
  const polys = subject.type === 'Polygon' ? [subject.coordinates] : subject.coordinates;
  if (!polys.length || !polys[0][0]?.length) return null;
  const [ox, oy] = polys[0][0][0];
  const mx = 111195 * Math.cos(oy * Math.PI / 180) * 1000, my = 111195 * 1000;
  const paths = (shape: Shape): ClipperLib.Paths => {
    const polygons = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
    return polygons.flatMap(rings => rings.map((ring, index) => {
      const path = ring.map(([x, y]) => ({ X: Math.round((x - ox) * mx), Y: Math.round((y - oy) * my) }));
      if (ClipperLib.Clipper.Orientation(path) !== (index === 0)) path.reverse();
      return path;
    }));
  };
  const operation = new ClipperLib.Clipper(2 /* ioStrictlySimple */);
  operation.AddPaths(paths(subject), ClipperLib.PolyType.ptSubject, true);
  for (const shape of subtract) operation.AddPaths(paths(shape), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  if (!operation.Execute(subtract.length ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion,
    tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) throw new Error('Gebietsgrenzen konnten nicht berechnet werden.');
  const ring = (path: ClipperLib.Path) => {
    const points = path.map(p => [ox + p.X / mx, oy + p.Y / my]);
    if (points.length) points.push([...points[0]]);
    return points;
  };
  const coordinates = ClipperLib.JS.PolyTreeToExPolygons(tree).map(p => [ring(p.outer), ...p.holes.map(ring)]);
  if (!coordinates.length) return null;
  return coordinates.length === 1 ? { type: 'Polygon', coordinates: coordinates[0] } : { type: 'MultiPolygon', coordinates };
}

export const normalizeShape = (shape: Shape) => clip(shape, []);
export const subtractShape = (subject: Shape, subtract: Shape[]) => clip(subject, subtract);
