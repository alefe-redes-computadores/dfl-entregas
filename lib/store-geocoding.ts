import type { LatLngPoint } from '@/lib/maps';

export async function geocodeStoreAddress(address: string): Promise<LatLngPoint> {
  const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) {
    throw new Error(data.error || 'Não foi possível localizar o endereço cadastrado da loja.');
  }
  return { lat: data.lat, lng: data.lng };
}
