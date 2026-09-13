import type { LatLngPoint } from '@/lib/maps';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';

const addressCache = new Map<string, LatLngPoint>();
let mapsLoader: Promise<void> | null = null;

const PATOS_CENTER = {
  latitude: -18.5789,
  longitude: -46.5186,
};

const PATOS_BOUNDS = {
  lon1: -46.72,
  lat1: -18.80,
  lon2: -46.30,
  lat2: -18.35,
};

function inPatosBounds(point: LatLngPoint) {
  return (
    point.lat >= PATOS_BOUNDS.lat1 &&
    point.lat <= PATOS_BOUNDS.lat2 &&
    point.lng >= PATOS_BOUNDS.lon1 &&
    point.lng <= PATOS_BOUNDS.lon2
  );
}

export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mapa indisponível neste ambiente.'));
  }

  if (window.google?.maps?.Geocoder) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Chave Google Maps não configurada.'));
  }

  mapsLoader = new Promise<void>((resolve, reject) => {
    const existing =
      document.querySelector<HTMLScriptElement>('script[data-dfl-google-maps]');

    if (existing) {
      if (window.google?.maps?.Geocoder) {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar o serviço do Google Maps.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.dataset.dflGoogleMaps = 'true';
    script.async = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&language=pt-BR&region=BR&v=weekly&loading=async';

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Falha ao carregar o serviço do Google Maps.'));
    document.head.appendChild(script);
  });

  return mapsLoader;
}

function queryCandidates(address: string) {
  const canonical = canonicalizeOperationalAddress(address).address;

  const candidates = [address.trim(), canonical]
    .filter(Boolean)
    .map((item) =>
      /patos de minas/i.test(item)
        ? item
        : `${item}, Patos de Minas - MG, Brasil`,
    );

  return Array.from(new Set(candidates));
}

async function geocodeWithGeoapify(query: string): Promise<LatLngPoint | null> {
  const key = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim();
  if (!key) return null;

  const params = new URLSearchParams({
    text: query,
    apiKey: key,
    format: 'geojson',
    lang: 'pt',
    limit: '5',
    filter: `rect:${PATOS_BOUNDS.lon1},${PATOS_BOUNDS.lat1},${PATOS_BOUNDS.lon2},${PATOS_BOUNDS.lat2}`,
    bias: `proximity:${PATOS_CENTER.longitude},${PATOS_CENTER.latitude}`,
  });

  const response = await fetch(
    `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
    {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Geoapify ${response.status}`);
  }

  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  for (const feature of features) {
    const props = feature?.properties || {};
    const lat = Number(props.lat ?? feature?.geometry?.coordinates?.[1]);
    const lng = Number(props.lon ?? feature?.geometry?.coordinates?.[0]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const point = { lat, lng };
    if (inPatosBounds(point)) return point;
  }

  return null;
}

async function geocodeWithGoogle(query: string): Promise<LatLngPoint | null> {
  try {
    await loadGoogleMaps();
  } catch {
    return null;
  }

  const geocoder = new window.google.maps.Geocoder();

  const result = await new Promise<google.maps.GeocoderResult | null>(
    (resolve) => {
      geocoder.geocode(
        {
          address: query,
          region: 'BR',
          componentRestrictions: {
            country: 'BR',
          },
        },
        (results, status) => {
          if (status === 'OK' && results?.[0]) resolve(results[0]);
          else resolve(null);
        },
      );
    },
  );

  if (!result) return null;

  const point = {
    lat: result.geometry.location.lat(),
    lng: result.geometry.location.lng(),
  };

  return inPatosBounds(point) ? point : null;
}

export async function geocodeAddress(address: string): Promise<LatLngPoint> {
  const canonical = canonicalizeOperationalAddress(address).address;

  if (!canonical) {
    throw new Error('Endereço vazio ou inválido.');
  }

  const key = canonical.toLocaleLowerCase('pt-BR').trim();
  const cached = addressCache.get(key);
  if (cached) return cached;

  const candidates = queryCandidates(address);
  const failures: string[] = [];

  // O autocomplete do app já usa Geoapify. O organizador passa a usar
  // a mesma fonte primeiro, evitando "dois cérebros" incompatíveis.
  for (const query of candidates) {
    try {
      const point = await geocodeWithGeoapify(query);
      if (point) {
        addressCache.set(key, point);
        return point;
      }
      failures.push(`Geoapify sem resultado: ${query}`);
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : 'Falha Geoapify',
      );
    }
  }

  // Google fica como segunda fonte, nunca como única chance.
  for (const query of candidates) {
    try {
      const point = await geocodeWithGoogle(query);
      if (point) {
        addressCache.set(key, point);
        return point;
      }
      failures.push(`Google sem resultado: ${query}`);
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : 'Falha Google',
      );
    }
  }

  const reason = failures.slice(-2).join(' · ');
  throw new Error(
    reason
      ? `Endereço não localizado. ${reason}`
      : 'Endereço não localizado pelas fontes disponíveis.',
  );
}

export const geocodeStoreAddress = geocodeAddress;
