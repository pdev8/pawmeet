import { describe, expect, it } from 'vitest';

import { buildIndex, clustersFor, expansionRegion, zoomForRegion, type ClusterPoint } from './cluster';

describe('zoomForRegion', () => {
  it('maps a wide span to a low zoom and a tight span to a high zoom', () => {
    const wide = zoomForRegion({ latitude: 0, longitude: 0, latitudeDelta: 180, longitudeDelta: 180 });
    const tight = zoomForRegion({ latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    expect(wide).toBeLessThan(tight);
    expect(wide).toBeGreaterThanOrEqual(0);
    expect(tight).toBeLessThanOrEqual(20);
  });
});

const oc: ClusterPoint[] = [
  { id: 'a', kind: 'event', lat: 33.68, lng: -117.83 },
  { id: 'b', kind: 'event', lat: 33.681, lng: -117.831 },
  { id: 'c', kind: 'place', lat: 33.6805, lng: -117.8305 },
];

describe('clustersFor', () => {
  it('returns [] for no points', () => {
    expect(clustersFor(buildIndex([]), [], {
      latitude: 33.7, longitude: -117.8, latitudeDelta: 0.5, longitudeDelta: 0.5,
    })).toEqual([]);
  });

  it('clusters nearby points when zoomed out', () => {
    const index = buildIndex(oc);
    const out = clustersFor(index, oc, {
      latitude: 33.68, longitude: -117.83, latitudeDelta: 2, longitudeDelta: 2,
    });
    // At a wide zoom the three tightly-packed points collapse into one cluster.
    expect(out.length).toBe(1);
    expect(out[0].cluster).toBe(true);
    if (out[0].cluster) expect(out[0].count).toBe(3);
  });

  it('shows individual points when zoomed in', () => {
    const index = buildIndex(oc);
    const out = clustersFor(index, oc, {
      latitude: 33.68, longitude: -117.83, latitudeDelta: 0.002, longitudeDelta: 0.002,
    });
    expect(out.every((c) => !c.cluster)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('expansionRegion', () => {
  it('returns a tighter region centered on the cluster', () => {
    const index = buildIndex(oc);
    const wide = { latitude: 33.68, longitude: -117.83, latitudeDelta: 2, longitudeDelta: 2 };
    const [c] = clustersFor(index, oc, wide);
    if (!c.cluster) throw new Error('expected a cluster');
    const r = expansionRegion(index, c.id, c.lat, c.lng);
    expect(r.latitude).toBe(c.lat);
    expect(r.longitude).toBe(c.lng);
    expect(r.longitudeDelta).toBeLessThan(wide.longitudeDelta);
  });
});

describe('pointDisplays', () => {
  it('marks close points as a single leader + members at the centroid when zoomed out', async () => {
    const { pointDisplays } = await import('./cluster');
    const index = buildIndex(oc);
    const map = pointDisplays(index, oc, {
      latitude: 33.68, longitude: -117.83, latitudeDelta: 2, longitudeDelta: 2,
    });
    const roles = oc.map((pt) => map.get(pt.id)!.role);
    expect(roles.filter((r) => r === 'leader')).toHaveLength(1);
    expect(roles.filter((r) => r === 'member')).toHaveLength(2);
    // all members slide to the same centroid as the leader
    const targets = new Set(oc.map((pt) => `${map.get(pt.id)!.target.lat},${map.get(pt.id)!.target.lng}`));
    expect(targets.size).toBe(1);
  });

  it('marks each point standalone at its own spot when zoomed in', async () => {
    const { pointDisplays } = await import('./cluster');
    const index = buildIndex(oc);
    const map = pointDisplays(index, oc, {
      latitude: 33.68, longitude: -117.83, latitudeDelta: 0.002, longitudeDelta: 0.002,
    });
    for (const pt of oc) {
      const d = map.get(pt.id)!;
      expect(d.role).toBe('standalone');
      expect(d.target).toEqual({ lat: pt.lat, lng: pt.lng });
    }
  });
});
