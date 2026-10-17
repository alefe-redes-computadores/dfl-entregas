import type { LatLngPoint } from '@/lib/maps';
import { extractLatLngFromMapsUrl } from '@/lib/maps';

/** Não aceitar (0,0), NaN ou coordenadas vazias como origem real da loja. */
export function validOriginPoint(lat: unknown, lng: unknown): LatLngPoint | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
    (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export function storedOriginPoint(settings: {
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  storeMapsLink?: string | null;
} | null | undefined): LatLngPoint | null {
  const numeric = validOriginPoint(settings?.storeLatitude, settings?.storeLongitude);
  if (numeric) return numeric;
  const linked = extractLatLngFromMapsUrl(settings?.storeMapsLink);
  return linked ? validOriginPoint(linked.lat, linked.lng) : null;
}

/** Geocodificar apenas a cidade pode originar uma rota no centro da cidade. */
export function hasSpecificStoreAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const clean = address.trim();
  return /\b(rua|avenida|av\.?|travessa|alameda|praça|praca|rodovia|estrada|br[-\s]?\d+)\b/i.test(clean) &&
    /\b(\d{1,5}|s\/?n)\b/i.test(clean);
}
