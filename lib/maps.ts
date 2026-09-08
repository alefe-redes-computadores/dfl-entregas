/**
 * Extrai coordenadas (latitude, longitude) de qualquer link manual do Google Maps
 */
export function extractCoordinatesFromUrl(url?: string | null): string | null {
  if (!url) return null;

  // Formato: /@(-18.xxxxxx),(-46.xxxxxx)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return `${atMatch[1]},${atMatch[2]}`;

  // Formato: ?q=(-18.xxxxxx),(-46.xxxxxx) ou ll=(-18.xxxxxx),(-46.xxxxxx)
  const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return `${qMatch[1]},${qMatch[2]}`;

  // Formato: destination=(-18.xxxxxx),(-46.xxxxxx)
  const destMatch = url.match(/[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (destMatch) return `${destMatch[1]},${destMatch[2]}`;

  return null;
}

/**
 * Normaliza o texto informado sem inventar rua, bairro, número ou cidade.
 */
export function normalizeAddressText(rawAddress: string): string {
  return rawAddress
    .replace(/\r?\n+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/[,|-]\s*$/, '')
    .trim();
}

/**
 * Higieniza o endereço focando na entrega em Patos de Minas
 * Prioriza "Rua/Av, Número, Patos de Minas - MG" ignorando ruídos
 */
export function cleanAddressForMaps(rawAddress: string): string {
  if (!rawAddress) return 'Patos de Minas, MG';

  const clean = normalizeAddressText(rawAddress)
    .replace(/[#&+\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = clean.split(',');
  const street = parts[0]?.trim() || '';
  const afterStreet = parts.slice(1).join(',').trim();

  const numberMatch = afterStreet.match(/\d+/);
  const numberStr = numberMatch ? numberMatch[0] : '';

  let finalQuery = street;
  if (numberStr) {
    finalQuery += `, ${numberStr}`;
  }

  if (!finalQuery.toLowerCase().includes('patos de minas')) {
    finalQuery += ', Patos de Minas - MG';
  }

  return finalQuery;
}

/**
 * Resolve o ponto da parada com tolerância a falhas
 */
export function resolveStopLocation(delivery: { address_string: string }, mapsLink?: string | null): string {
  if (mapsLink && mapsLink.includes('http')) {
    const coords = extractCoordinatesFromUrl(mapsLink);
    if (coords) return coords;
  }
  return cleanAddressForMaps(delivery.address_string);
}

/**
 * Constrói a URL de rota otimizada sem quebrar paradas
 */
export function buildGoogleMapsRouteUrl(origin: string, stops: string[]): string {
  if (!stops || stops.length === 0) return '';

  const cleanOrigin = cleanAddressForMaps(origin);

  if (stops.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanOrigin)}&destination=${encodeURIComponent(stops[0])}`;
  }

  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanOrigin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
}

export type LatLngPoint = {
  lat: number;
  lng: number;
};

export function parseCoordinateString(value?: string | null): LatLngPoint | null {
  if (!value) return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function extractLatLngFromMapsUrl(url?: string | null): LatLngPoint | null {
  return parseCoordinateString(extractCoordinatesFromUrl(url));
}

export function distanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return radius * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function optimizePointsNearestNeighbor<T extends { point: LatLngPoint }>(
  origin: LatLngPoint,
  entries: T[],
): T[] {
  const remaining = [...entries];
  const ordered: T[] = [];
  let cursor = origin;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = distanceMeters(cursor, remaining[0].point);

    for (let index = 1; index < remaining.length; index += 1) {
      const candidate = distanceMeters(cursor, remaining[index].point);
      if (candidate < bestDistance) {
        bestDistance = candidate;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next.point;
  }

  return ordered;
}

export function formatDistance(distance: number): string {
  if (!Number.isFinite(distance)) return '—';
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1).replace('.', ',')} km`;
}
