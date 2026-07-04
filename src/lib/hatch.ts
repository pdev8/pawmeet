import type { MapPoint } from './places';

interface XY {
  x: number;
  y: number;
}

/**
 * Generate crosshatch line segments (45° and 135°) clipped to a polygon,
 * for drawing a hatched fill on a map. Returns segments as [start, end]
 * coordinate pairs. Spacing adapts upward so no polygon exceeds
 * `maxLinesPerDirection` scanlines.
 */
export function crosshatch(
  ring: MapPoint[],
  spacingM = 35,
  maxLinesPerDirection = 12,
): MapPoint[][] {
  if (ring.length < 3) return [];
  const lat0 = ring[0].latitude;
  const mLat = 111132;
  const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const lng0 = ring[0].longitude;

  const xy: XY[] = ring.map((p) => ({
    x: (p.longitude - lng0) * mLng,
    y: (p.latitude - lat0) * mLat,
  }));

  const toMap = (p: XY): MapPoint => ({
    latitude: lat0 + p.y / mLat,
    longitude: lng0 + p.x / mLng,
  });

  const segments: MapPoint[][] = [];
  for (const angleDeg of [45, 135]) {
    const a = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Rotate so hatch lines become horizontal scanlines.
    const rot: XY[] = xy.map((p) => ({
      x: p.x * cos + p.y * sin,
      y: -p.x * sin + p.y * cos,
    }));
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const p of rot) {
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    }
    const extent = yMax - yMin;
    if (extent < spacingM) continue;
    const spacing = Math.max(spacingM, extent / maxLinesPerDirection);

    for (let y = yMin + spacing / 2; y < yMax; y += spacing) {
      // Even-odd intersections of the scanline with polygon edges.
      const xs: number[] = [];
      for (let i = 0; i < rot.length; i++) {
        const p1 = rot[i];
        const p2 = rot[(i + 1) % rot.length];
        if (p1.y <= y !== p2.y <= y) {
          xs.push(p1.x + ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        // Rotate back to map space.
        const s: XY = { x: xs[i] * cos - y * sin, y: xs[i] * sin + y * cos };
        const e: XY = { x: xs[i + 1] * cos - y * sin, y: xs[i + 1] * sin + y * cos };
        segments.push([toMap(s), toMap(e)]);
      }
    }
  }
  return segments;
}
