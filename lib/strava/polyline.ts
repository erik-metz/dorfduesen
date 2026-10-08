/**
 * Decodes an encoded polyline string (Google Encoded Polyline Format used by Strava)
 * and generates SVG path coordinates normalized to a view box.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export function polylineToSvgPath(
  encoded: string,
  width = 200,
  height = 120,
  padding = 10
): string | null {
  try {
    const points = decodePolyline(encoded);
    if (points.length < 2) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lat, lng] of points) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latRange = maxLat - minLat || 1e-6;
    const lngRange = maxLng - minLng || 1e-6;

    const innerWidth = width - 2 * padding;
    const innerHeight = height - 2 * padding;

    // Convert lat/lng to screen coordinates (lat goes up -> y goes down)
    const coords = points.map(([lat, lng]) => {
      const x = padding + ((lng - minLng) / lngRange) * innerWidth;
      const y = padding + (1 - (lat - minLat) / latRange) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${coords.join(' L ')}`;
  } catch {
    return null;
  }
}
