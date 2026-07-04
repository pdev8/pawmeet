import type { LatLng } from './types';

const EARTH_RADIUS_MI = 3958.8;

export function distanceMi(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/** Offset a point by miles east/north (approximate, fine for demo data). */
export function offsetMi(origin: LatLng, eastMi: number, northMi: number): LatLng {
  const lat = origin.lat + northMi / 69;
  const lng = origin.lng + eastMi / (69 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat, lng };
}

export function fmtDistance(mi: number): string {
  if (mi < 0.1) return 'nearby';
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

export const DEFAULT_CENTER: LatLng = { lat: 30.2672, lng: -97.7431 };
export const DEFAULT_CENTER_LABEL = 'Austin, TX';
