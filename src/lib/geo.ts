export type GeoPoint = {
  lat: number;
  lng: number;
};

export type Place = GeoPoint & {
  id: string;
  name: string;
};

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in miles. */
export function distanceMiles(origin: GeoPoint, target: GeoPoint): number {
  const dLat = toRadians(target.lat - origin.lat);
  const dLng = toRadians(target.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(target.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Closest places to a point. Ties break by name. */
export function nearest<T extends Place>(
  origin: GeoPoint,
  places: readonly T[],
  options?: { excludeId?: string; limit?: number },
): T[] {
  const excludeId = options?.excludeId;
  const ranked = places
    .filter(
      (place) => place.id !== excludeId && Number.isFinite(place.lat) && Number.isFinite(place.lng),
    )
    .sort((a, b) => {
      const delta = distanceMiles(origin, a) - distanceMiles(origin, b);
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });
  return options?.limit === undefined ? ranked : ranked.slice(0, options.limit);
}

/** Whole miles, with a floor so a short hop does not read as zero. */
export function formatMiles(miles: number): string {
  const rounded = Math.round(miles);
  return rounded < 1 ? 'Less than 1 mi' : `${rounded} mi`;
}
