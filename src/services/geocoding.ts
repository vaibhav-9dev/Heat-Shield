/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  bbox: [number, number, number, number]; // [minLat, minLon, maxLat, maxLon]
}

/**
 * Searches city using Open-Meteo Geocoding API.
 * F1: Default city resolved through search (not hardcoded coordinates).
 */
export async function searchCity(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed
  )}&count=5&language=en&format=json`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Geocoding failed with status ${resp.status}`);
  }

  const data = await resp.json();
  if (!data.results || data.results.length === 0) {
    return [];
  }

  return data.results.map((r: any) => {
    // Generate ~12 km bounding box if open-meteo doesn't provide bbox directly
    // 0.05 deg latitude is ~5.5 km
    const latDelta = 0.06;
    const lonDelta = 0.06;

    const minLat = r.latitude - latDelta;
    const maxLat = r.latitude + latDelta;
    const minLon = r.longitude - lonDelta;
    const maxLon = r.longitude + lonDelta;

    return {
      id: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
      admin1: r.admin1,
      bbox: [minLat, minLon, maxLat, maxLon],
    };
  });
}
