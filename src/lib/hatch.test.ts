import { describe, expect, it } from 'vitest';

import { crosshatch } from './hatch';
import type { MapPoint } from './places';

// ~200m square near Austin (lat 30). dLat = 200/111132, dLng = 200/(111320*cos30).
const LAT0 = 30;
const LNG0 = -97;
const D_LAT = 200 / 111132;
const D_LNG = 200 / (111320 * Math.cos((LAT0 * Math.PI) / 180));
const SQUARE: MapPoint[] = [
  { latitude: LAT0, longitude: LNG0 },
  { latitude: LAT0, longitude: LNG0 + D_LNG },
  { latitude: LAT0 + D_LAT, longitude: LNG0 + D_LNG },
  { latitude: LAT0 + D_LAT, longitude: LNG0 },
];

const bbox = {
  minLat: LAT0,
  maxLat: LAT0 + D_LAT,
  minLng: LNG0,
  maxLng: LNG0 + D_LNG,
};

describe('crosshatch', () => {
  it('returns nothing for a degenerate ring', () => {
    expect(crosshatch([])).toEqual([]);
    expect(crosshatch([SQUARE[0], SQUARE[1]])).toEqual([]);
  });

  it('produces [start, end] segment pairs for a polygon', () => {
    const segs = crosshatch(SQUARE);
    expect(segs.length).toBeGreaterThan(0);
    for (const seg of segs) {
      expect(seg).toHaveLength(2);
      for (const pt of seg) {
        expect(typeof pt.latitude).toBe('number');
        expect(typeof pt.longitude).toBe('number');
      }
    }
  });

  it('clips every segment endpoint inside the polygon bounding box', () => {
    const eps = 1e-6;
    for (const seg of crosshatch(SQUARE)) {
      for (const pt of seg) {
        expect(pt.latitude).toBeGreaterThanOrEqual(bbox.minLat - eps);
        expect(pt.latitude).toBeLessThanOrEqual(bbox.maxLat + eps);
        expect(pt.longitude).toBeGreaterThanOrEqual(bbox.minLng - eps);
        expect(pt.longitude).toBeLessThanOrEqual(bbox.maxLng + eps);
      }
    }
  });

  it('draws more lines as spacing tightens', () => {
    const tight = crosshatch(SQUARE, 10, 24).length;
    const loose = crosshatch(SQUARE, 50, 24).length;
    expect(tight).toBeGreaterThan(loose);
  });

  it('draws more lines as the per-direction cap rises', () => {
    const few = crosshatch(SQUARE, 1, 4).length;
    const many = crosshatch(SQUARE, 1, 24).length;
    expect(many).toBeGreaterThan(few);
  });
});
