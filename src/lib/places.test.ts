import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  categorize,
  demoReviews,
  placeRating,
  ringAreaM2,
  searchAddresses,
  type DogPlace,
  type MapPoint,
} from './places';

const mkPlace = (over: Partial<DogPlace> = {}): DogPlace => ({
  id: 'way-1',
  name: 'Zilker Park',
  category: 'park',
  center: { latitude: 30, longitude: -97 },
  areaM2: 40000,
  ...over,
});

describe('placeRating', () => {
  it('is deterministic for a given id', () => {
    expect(placeRating(mkPlace({ id: 'way-42' }))).toBe(placeRating(mkPlace({ id: 'way-42' })));
  });

  it('stays within the 3.9–4.9 demo band', () => {
    for (const id of ['a', 'b', 'way-1', 'way-999', 'node-7']) {
      const r = placeRating(mkPlace({ id }));
      expect(r).toBeGreaterThanOrEqual(3.9);
      expect(r).toBeLessThanOrEqual(4.9);
    }
  });
});

describe('categorize', () => {
  it('maps OSM tags to a category', () => {
    expect(categorize({ leisure: 'dog_park' })).toBe('dog_park');
    expect(categorize({ leisure: 'park' })).toBe('park');
    expect(categorize({ leisure: 'nature_reserve' })).toBe('nature_reserve');
    expect(categorize({ natural: 'beach' })).toBe('beach');
    expect(categorize({ highway: 'path' })).toBe('trail');
    expect(categorize({ highway: 'track' })).toBe('trail');
    expect(categorize({ route: 'hiking' })).toBe('trail');
  });

  it('returns null for untagged / irrelevant ways', () => {
    expect(categorize({})).toBeNull();
    expect(categorize({ amenity: 'cafe' })).toBeNull();
  });

  it('prefers the more specific category when tags overlap', () => {
    expect(categorize({ leisure: 'dog_park', leisure_extra: 'park' })).toBe('dog_park');
    expect(categorize({ natural: 'beach', leisure: 'park' })).toBe('beach');
  });
});

describe('ringAreaM2', () => {
  it('approximates the area of a ~200m square', () => {
    const dLat = 200 / 111132;
    const dLng = 200 / (111320 * Math.cos((30 * Math.PI) / 180));
    const square: MapPoint[] = [
      { latitude: 30, longitude: -97 },
      { latitude: 30, longitude: -97 + dLng },
      { latitude: 30 + dLat, longitude: -97 + dLng },
      { latitude: 30 + dLat, longitude: -97 },
    ];
    const area = ringAreaM2(square);
    expect(area).toBeGreaterThan(38000);
    expect(area).toBeLessThan(42000);
  });

  it('is zero for a degenerate ring', () => {
    expect(ringAreaM2([{ latitude: 30, longitude: -97 }])).toBe(0);
  });
});

describe('demoReviews', () => {
  const reviewers = [
    { displayName: 'Sam', avatarUrl: 'http://a/sam.png' },
    { displayName: 'Mia', avatarUrl: 'http://a/mia.png' },
    { displayName: 'Lee', avatarUrl: 'http://a/lee.png' },
  ];

  it('is deterministic for the same place + reviewers', () => {
    const a = demoReviews(mkPlace(), reviewers);
    const b = demoReviews(mkPlace(), reviewers);
    expect(a).toEqual(b);
  });

  it('returns 2–3 reviews rated 4 or 5', () => {
    const out = demoReviews(mkPlace({ id: 'way-7' }), reviewers);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.length).toBeLessThanOrEqual(3);
    for (const r of out) {
      expect([4, 5]).toContain(r.rating);
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  it('returns nothing when there are no reviewers', () => {
    expect(demoReviews(mkPlace(), [])).toEqual([]);
  });
});

describe('searchAddresses', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns [] for short queries without hitting the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchAddresses('ab')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps Nominatim hits to lat/lng + a short label + full name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { lat: '33.66', lon: '-118.00', display_name: 'Huntington Dog Beach, Huntington Beach, CA, USA' },
        ],
      }),
    );
    const out = await searchAddresses('huntington dog beach');
    expect(out).toEqual([
      {
        lat: 33.66,
        lng: -118.0,
        label: 'Huntington Dog Beach, Huntington Beach',
        full: 'Huntington Dog Beach, Huntington Beach, CA, USA',
      },
    ]);
  });

  it('returns [] on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await searchAddresses('somewhere')).toEqual([]);
  });
});
