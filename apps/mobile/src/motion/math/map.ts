export const MAP_TILE_SIZE = 256;
export const MIN_MAP_ZOOM = 3;
export const MAX_MAP_ZOOM = 16;

export interface LatLng {
  lat: number;
  lng: number;
}

export function project({ lat, lng }: LatLng, zoom: number): { x: number; y: number } {
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

export function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  // The map wraps horizontally, but latitude stops at the Web Mercator poles. Keeping the
  // committed centre inside those bounds prevents a long pan from producing invalid regions.
  const wrappedX = ((x % scale) + scale) % scale;
  const clampedY = Math.max(0, Math.min(scale, y));
  const lng = (wrappedX / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * clampedY) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
}

/** Centre and zoom that fit a set of points, for the first view of the map. */
export function fitRegion(points: LatLng[], width: number, height: number): { center: LatLng; zoom: number } {
  if (!points.length) return { center: { lat: 48.8566, lng: 2.3522 }, zoom: 12 };
  const lats = points.map((p) => p.lat);
  // Find the shortest longitude arc containing every point. A plain min/max would zoom out to
  // the whole planet for two nearby venues on opposite sides of the antimeridian.
  const sortedLngs = points.map((p) => ((p.lng % 360) + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1;
  let arcStart = sortedLngs[0]!;
  for (let index = 0; index < sortedLngs.length; index++) {
    const here = sortedLngs[index]!;
    const next = index === sortedLngs.length - 1 ? sortedLngs[0]! + 360 : sortedLngs[index + 1]!;
    if (next - here > largestGap) {
      largestGap = next - here;
      arcStart = next % 360;
    }
  }
  const arcWidth = 360 - largestGap;
  const centerLng = ((arcStart + arcWidth / 2 + 540) % 360) - 180;
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: centerLng };
  const relativeLng = (lng: number) => centerLng + ((((lng - centerLng) % 360) + 540) % 360) - 180;
  const unwrapped = points.map((point) => relativeLng(point.lng));
  for (let zoom = MAX_MAP_ZOOM; zoom > MIN_MAP_ZOOM; zoom--) {
    const a = project({ lat: Math.max(...lats), lng: Math.min(...unwrapped) }, zoom);
    const b = project({ lat: Math.min(...lats), lng: Math.max(...unwrapped) }, zoom);
    if (b.x - a.x < width * 0.8 && b.y - a.y < height * 0.7) return { center, zoom };
  }
  return { center, zoom: MIN_MAP_ZOOM };
}
