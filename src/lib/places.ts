import type { LatLng } from './types';

export type PlaceCategory = 'dog_park' | 'park' | 'nature_reserve' | 'beach' | 'trail';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface DogPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  /** Closed boundary — rendered as a crosshatched polygon. */
  ring?: MapPoint[];
  /** Open way (trail) — rendered as a dashed line. */
  line?: MapPoint[];
  center: MapPoint;
  /** Rough area in m² (rings only), used to prioritize what gets hatched. */
  areaM2: number;
  /** Raw OSM opening_hours tag, when the community has mapped it. */
  openingHours?: string;
  website?: string;
}

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  dog_park: 'Dog park',
  park: 'Park',
  nature_reserve: 'Nature reserve',
  beach: 'Beach',
  trail: 'Trail',
};

export interface AddressHit {
  lat: number;
  lng: number;
  label: string;
  full: string;
}

/** Address autocomplete via Nominatim — up to `limit` suggestions (empty for short queries). */
export async function searchAddresses(query: string, limit = 5): Promise<AddressHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Pawk-demo/1.0 (pet events prototype)' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return (data ?? []).map((h) => ({
    lat: parseFloat(h.lat),
    lng: parseFloat(h.lon),
    label: h.display_name.split(',').slice(0, 2).join(','),
    full: h.display_name,
  }));
}

export async function geocodeLocation(
  query: string,
): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Pawk-demo/1.0 (pet events prototype)' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const hit = data?.[0];
  if (!hit) return null;
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    label: hit.display_name.split(',').slice(0, 2).join(','),
  };
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassWay {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export function categorize(tags: Record<string, string>): PlaceCategory | null {
  if (tags.leisure === 'dog_park') return 'dog_park';
  if (tags.natural === 'beach') return 'beach';
  if (tags.leisure === 'nature_reserve') return 'nature_reserve';
  if (tags.leisure === 'park') return 'park';
  if (tags.highway === 'path' || tags.highway === 'track' || tags.route === 'hiking')
    return 'trail';
  return null;
}

export function ringAreaM2(pts: MapPoint[]): number {
  if (pts.length < 3) return 0;
  const lat0 = pts[0].latitude;
  const mLat = 111132;
  const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area +=
      a.longitude * mLng * (b.latitude * mLat) - b.longitude * mLng * (a.latitude * mLat);
  }
  return Math.abs(area / 2);
}

/**
 * Fetch dog-friendly places around a point from OpenStreetMap (Overpass).
 * Includes dog parks, parks, nature reserves, beaches, and named trails,
 * excluding anything explicitly tagged dog=no.
 */
export async function fetchDogFriendlyPlaces(
  center: LatLng,
  radiusM = 3500,
): Promise<DogPlace[]> {
  const around = `(around:${radiusM},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`;
  const query = `[out:json][timeout:25];
(
  way["leisure"="dog_park"]${around};
  way["leisure"="park"]["dog"!="no"]${around};
  way["leisure"="nature_reserve"]["dog"!="no"]${around};
  way["natural"="beach"]["dog"!="no"]${around};
  way["highway"~"^(path|track)$"]["name"]["dog"!="no"]${around};
);
out geom 200;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as { elements: OverpassWay[] };

  const places: DogPlace[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2 || !el.tags) continue;
    const category = categorize(el.tags);
    if (!category) continue;
    const pts: MapPoint[] = el.geometry.map((g) => ({ latitude: g.lat, longitude: g.lon }));
    const closed =
      pts.length > 3 &&
      pts[0].latitude === pts[pts.length - 1].latitude &&
      pts[0].longitude === pts[pts.length - 1].longitude;
    const ring = closed ? pts.slice(0, -1) : undefined;
    const line = !closed ? pts : undefined;
    // Trails are lines; boundary categories need a closed ring.
    if (category !== 'trail' && !ring) continue;
    if (category === 'trail' && ring) continue;
    const centerPt: MapPoint = {
      latitude: pts.reduce((s, q) => s + q.latitude, 0) / pts.length,
      longitude: pts.reduce((s, q) => s + q.longitude, 0) / pts.length,
    };
    places.push({
      id: `${el.type}-${el.id}`,
      name: el.tags.name ?? CATEGORY_LABELS[category],
      category,
      ring,
      line,
      center: centerPt,
      areaM2: ring ? ringAreaM2(ring) : 0,
      openingHours: el.tags.opening_hours,
      website: el.tags.website ?? el.tags['contact:website'],
    });
  }

  // Dog parks always win; then bigger areas first. Cap for map performance.
  places.sort((a, b) => {
    if ((a.category === 'dog_park') !== (b.category === 'dog_park'))
      return a.category === 'dog_park' ? -1 : 1;
    return b.areaM2 - a.areaM2;
  });
  return places.slice(0, 60);
}

// ---- Demo reviews -----------------------------------------------------------
// OSM has no review data and keyless APIs don't offer it, so until a real
// backend exists, reviews are generated deterministically per place from the
// app's mock community. Real user reviews replace this later.

export interface PlaceReview {
  author: string;
  avatarUrl: string;
  rating: number;
  text: string;
  when: string;
}

function hashId(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const REVIEW_TEMPLATES: Record<PlaceCategory, string[]> = {
  dog_park: [
    'Well fenced and plenty of shade — we made three new friends.',
    'Gets busy after 5pm but the regulars are friendly.',
    'Dog water fountain near the entrance. 10/10 would zoom again.',
    'Separate small-dog yard is a nice touch.',
  ],
  park: [
    'Plenty of open grass for zoomies, leash required though.',
    'Nice shaded loop for a morning walk.',
    'Squirrel-watching heaven. My dog rates it 5 squirrels.',
    'Busy on weekends — mornings are calmer.',
  ],
  nature_reserve: [
    'Quiet trails, saw more birds than people.',
    'Keep them leashed — lots of wildlife around.',
    'Beautiful in the early morning. Bring water.',
  ],
  beach: [
    'Soft sand and calm water — perfect first swim.',
    'Off-leash crowd shows up early, bring a towel.',
    'Sand gets hot at midday, plan around it.',
  ],
  trail: [
    'Good width for passing other dogs politely.',
    'Mostly shaded, a few muddy patches after rain.',
    'Great sniff-per-mile ratio.',
  ],
};

const REVIEW_WHEN = ['this week', '2 weeks ago', 'last month', '2 months ago'];

/** Aggregate demo rating, stable per place: 3.9–4.9. */
export function placeRating(place: DogPlace): number {
  return 3.9 + (hashId(place.id) % 11) / 10;
}

export function demoReviews(
  place: DogPlace,
  reviewers: { displayName: string; avatarUrl: string }[],
): PlaceReview[] {
  if (reviewers.length === 0) return [];
  const h = hashId(place.id);
  const count = 2 + (h % 2);
  const templates = REVIEW_TEMPLATES[place.category];
  return Array.from({ length: count }, (_, i) => {
    const u = reviewers[(h + i * 7) % reviewers.length];
    return {
      author: u.displayName,
      avatarUrl: u.avatarUrl,
      rating: 4 + ((h >> (i + 2)) % 2),
      text: templates[(h + i * 3) % templates.length],
      when: REVIEW_WHEN[(h + i * 5) % REVIEW_WHEN.length],
    };
  });
}
