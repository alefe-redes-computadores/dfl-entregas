import type { LatLngPoint } from '@/lib/maps';

const addressCache = new Map<string, LatLngPoint>();
let mapsLoader: Promise<void> | null = null;

export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Mapa indisponível neste ambiente.'));
  if (window.google?.maps?.Geocoder) return Promise.resolve();
  if (mapsLoader) return mapsLoader;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error('Chave de mapas não configurada.'));
  mapsLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-dfl-google-maps]');
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Falha ao carregar o serviço de mapas.')), { once: true }); return; }
    const script = document.createElement('script'); script.dataset.dflGoogleMaps = 'true'; script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=pt-BR&region=BR&v=weekly&loading=async`;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Falha ao carregar o serviço de mapas.')); document.head.appendChild(script);
  });
  return mapsLoader;
}

export async function geocodeAddress(address: string): Promise<LatLngPoint> {
  const key = address.trim().toLocaleLowerCase('pt-BR');
  const cached = addressCache.get(key);
  if (cached) return cached;

  await loadGoogleMaps();
  const query = /patos de minas/i.test(address) ? address : `${address}, Patos de Minas - MG, Brasil`;
  const result = await new Promise<google.maps.GeocoderResult>((resolve, reject) => new google.maps.Geocoder().geocode({ address: query, region: 'BR' }, (results, status) => status === 'OK' && results?.[0] ? resolve(results[0]) : reject(new Error(status === 'ZERO_RESULTS' ? 'Endereço não encontrado.' : `Mapa indisponível (${status}).`))));
  const point = { lat: result.geometry.location.lat(), lng: result.geometry.location.lng() };
  addressCache.set(key, point);
  return point;
}

export const geocodeStoreAddress = geocodeAddress;
