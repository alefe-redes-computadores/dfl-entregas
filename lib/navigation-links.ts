import { extractLatLngFromMapsUrl } from '@/lib/maps';
import { locationEvidence } from '@/lib/location-evidence';

/** Destinations are links, not GPS accuracy claims. No network or geocoding. */
export type NavigationLinks = { maps: string; waze: string; hasCoordinates: boolean };
export function buildNavigationLinks(address?: string | null, mapsLink?: string | null): NavigationLinks | null {
  const clean = String(address || '').trim();
  const evidence = locationEvidence(clean, mapsLink);
  // Reject untrusted map hosts even when a malicious URL includes @lat,lng.
  const coords = evidence.kind === 'coordinate' ? extractLatLngFromMapsUrl(mapsLink) : null;
  const destination = coords ? `${coords.lat},${coords.lng}` : clean;
  if (!destination) return null;
  const query = (Boolean(coords) || /patos de minas/i.test(destination)) ? destination : `${destination}, Patos de Minas - MG`;
  return {
    maps: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`,
    waze: coords
      ? `https://waze.com/ul?ll=${encodeURIComponent(query)}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`,
    hasCoordinates: Boolean(coords),
  };
}
