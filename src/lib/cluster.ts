import Supercluster from 'supercluster';

export interface ClusterPoint {
  id: string;
  kind: 'place' | 'event';
  lat: number;
  lng: number;
}

export interface RegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export type ClusterResult =
  | { cluster: true; id: number; count: number; lat: number; lng: number }
  | { cluster: false; point: ClusterPoint };

/** Map a MapView region to an integer tile zoom for supercluster. */
export function zoomForRegion(region: RegionLike): number {
  const delta = Math.max(region.longitudeDelta, 1e-6);
  return Math.max(0, Math.min(20, Math.round(Math.log2(360 / delta))));
}

type PointFeature = Supercluster.PointFeature<{ pt: ClusterPoint }>;

/** Build a supercluster index over the given points. A smaller `radius` (px)
 * clusters less aggressively — points only merge when they're genuinely close. */
export function buildIndex(
  points: ClusterPoint[],
  radius = 38,
): Supercluster<{ pt: ClusterPoint }> {
  const index = new Supercluster<{ pt: ClusterPoint }>({ radius, maxZoom: 16 });
  const features: PointFeature[] = points.map((p) => ({
    type: 'Feature',
    properties: { pt: p },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  }));
  index.load(features);
  return index;
}

/** Clusters + lone points visible in the region, at its zoom. */
export function clustersFor(
  index: Supercluster<{ pt: ClusterPoint }>,
  points: ClusterPoint[],
  region: RegionLike,
): ClusterResult[] {
  if (points.length === 0) return [];
  const zoom = zoomForRegion(region);
  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  return index.getClusters([west, south, east, north], zoom).map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties as {
      cluster?: boolean;
      cluster_id?: number;
      point_count?: number;
      pt?: ClusterPoint;
    };
    if (props.cluster) {
      return { cluster: true, id: props.cluster_id as number, count: props.point_count as number, lat, lng };
    }
    return { cluster: false, point: props.pt as ClusterPoint };
  });
}

/**
 * Per-point display state for a "sticky" animated cluster: every underlying
 * point stays mounted and slides to `target` — its own spot when standalone,
 * or its cluster's centroid when grouped. One point per cluster is the `leader`
 * (renders the count + handles the tap); the rest are hidden `member`s stacked
 * under it. Points outside the viewport default to standalone at their own spot.
 */
export interface PointDisplay {
  target: { lat: number; lng: number };
  role: 'standalone' | 'leader' | 'member';
  count: number;
  clusterId?: number;
}

export function pointDisplays(
  index: Supercluster<{ pt: ClusterPoint }>,
  points: ClusterPoint[],
  region: RegionLike,
): Map<string, PointDisplay> {
  const out = new Map<string, PointDisplay>();
  if (points.length === 0) return out;
  const zoom = zoomForRegion(region);
  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;

  for (const f of index.getClusters([west, south, east, north], zoom)) {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties as {
      cluster?: boolean;
      cluster_id?: number;
      point_count?: number;
      pt?: ClusterPoint;
    };
    if (props.cluster) {
      const leaves = index.getLeaves(props.cluster_id as number, Infinity);
      leaves.forEach((leaf, i) => {
        const id = (leaf.properties as { pt: ClusterPoint }).pt.id;
        out.set(id, {
          target: { lat, lng },
          role: i === 0 ? 'leader' : 'member',
          count: props.point_count as number,
          clusterId: props.cluster_id,
        });
      });
    } else {
      const pt = props.pt as ClusterPoint;
      out.set(pt.id, { target: { lat: pt.lat, lng: pt.lng }, role: 'standalone', count: 1 });
    }
  }
  // Anything off-screen keeps its own spot so it's ready when panned into view.
  for (const p of points) {
    if (!out.has(p.id)) out.set(p.id, { target: { lat: p.lat, lng: p.lng }, role: 'standalone', count: 1 });
  }
  return out;
}

/** A region centered on a cluster, zoomed in to where it breaks apart. */
export function expansionRegion(
  index: Supercluster<{ pt: ClusterPoint }>,
  clusterId: number,
  lat: number,
  lng: number,
): RegionLike {
  const zoom = Math.min(18, index.getClusterExpansionZoom(clusterId));
  const delta = 360 / 2 ** zoom;
  return { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
}
