/** Rwanda city coordinates used when legacy station rows store plain text locations. */
export const RWANDA_STATION_COORDS: Record<string, [number, number]> = {
  kigali: [-1.95, 30.06],
  musanze: [-1.5, 29.63],
  huye: [-2.6, 29.74],
  rubavu: [-1.68, 29.26],
  rusizi: [-2.47, 28.9],
  nyagatare: [-1.28, 30.32],
  karongi: [-2.08, 29.75],
  nyanza: [-2.0, 29.35],
  muhanga: [-1.95, 30.43],
  kayonza: [-1.93, 30.55],
};

/**
 * Parse a station location string into `[lat, lng]`.
 * Accepts canonical `lat,lng` values and falls back to known Rwanda cities.
 */
export function parseStationLocation(location: string | null | undefined): [number, number] | null {
  if (!location) return null;

  const trimmed = location.trim();
  const [latRaw, lngRaw] = trimmed.split(',').map((part) => part.trim());
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng];
  }

  const normalized = trimmed.toLowerCase();
  for (const [city, coords] of Object.entries(RWANDA_STATION_COORDS)) {
    if (normalized.includes(city)) {
      return coords;
    }
  }

  return null;
}

/** Serialize coordinates for storage in `Station.location`. */
export function formatStationLocation(lat: number, lng: number): string {
  return `${lat},${lng}`;
}
