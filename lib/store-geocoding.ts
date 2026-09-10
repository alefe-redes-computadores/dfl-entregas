import type { LatLngPoint } from '@/lib/maps';

const addressCache = new Map<string, LatLngPoint>();

export async function geocodeAddress(address: string): Promise<LatLngPoint> {
  const key = address.trim().toLocaleLowerCase('pt-BR');
  const cached = addressCache.get(key);
  if (cached) return cached;

  const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) {
    throw new Error(data.error || 'Não foi possível localizar o endereço.');
  }
  const point = { lat: data.lat, lng: data.lng };
  addressCache.set(key, point);
  return point;
}

export const geocodeStoreAddress = geocodeAddress;
