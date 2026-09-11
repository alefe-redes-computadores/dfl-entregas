// lib/address-autocomplete.ts
import { normalizeAddressText } from '@/lib/maps';

export interface AddressSuggestion {
  id: string;
  label: string;
  primary: string;
  secondary?: string;
  prediction: GeoapifyFeature;
}

export interface ResolvedAddressSuggestion {
  address: string;
  formattedAddress: string;
  neighborhood?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  mapsLink?: string;
  placeId?: string;
}

interface GeoapifyFeature {
  type: 'Feature';
  properties?: {
    place_id?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    suburb?: string;
    district?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    lat?: number;
    lon?: number;
    rank?: {
      confidence?: number;
      confidence_city_level?: number;
      confidence_street_level?: number;
      confidence_building_level?: number;
    };
  };
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
}

interface GeoapifyResponse {
  type?: string;
  features?: GeoapifyFeature[];
}

const GEOAPIFY_ENDPOINT =
  'https://api.geoapify.com/v1/geocode/autocomplete';

// Centro aproximado de Patos de Minas.
// O bias melhora ranking; o filtro rectangular impede sugestões distantes.
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

let activeController: AbortController | null = null;

function getApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim();

  if (!key) {
    throw new Error(
      'Chave Geoapify não configurada. Defina NEXT_PUBLIC_GEOAPIFY_API_KEY.',
    );
  }

  return key;
}

function featureCoordinates(
  feature: GeoapifyFeature,
): { latitude?: number; longitude?: number } {
  const props = feature.properties;

  if (
    Number.isFinite(props?.lat) &&
    Number.isFinite(props?.lon)
  ) {
    return {
      latitude: props?.lat,
      longitude: props?.lon,
    };
  }

  const coordinates = feature.geometry?.coordinates;

  if (
    Array.isArray(coordinates) &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    return {
      longitude: coordinates[0],
      latitude: coordinates[1],
    };
  }

  return {};
}

function buildOperationalAddress(feature: GeoapifyFeature): {
  address: string;
  neighborhood?: string;
  postalCode?: string;
} {
  const props = feature.properties || {};

  const route =
    props.street ||
    props.address_line1 ||
    '';

  const number = props.housenumber || '';

  const neighborhood =
    props.neighbourhood ||
    props.suburb ||
    props.district ||
    undefined;

  const postalCode = props.postcode || undefined;

  if (route) {
    const street =
      number && !String(route).includes(String(number))
        ? `${route}, ${number}`
        : route;

    return {
      address: normalizeAddressText(
        neighborhood
          ? `${street} - ${neighborhood}`
          : street,
      ),
      neighborhood,
      postalCode,
    };
  }

  return {
    address: normalizeAddressText(
      props.formatted ||
      props.address_line1 ||
      '',
    ),
    neighborhood,
    postalCode,
  };
}

function compactSuggestionParts(feature: GeoapifyFeature): {
  primary: string;
  secondary?: string;
} {
  const props = feature.properties || {};
  const street = String(props.street || props.address_line1 || '').trim();
  const number = String(props.housenumber || '').trim();

  const primary =
    street && number && !street.includes(number)
      ? `${street}, ${number}`
      : street || String(props.formatted || '').trim();

  const neighborhood =
    props.neighbourhood ||
    props.suburb ||
    props.district ||
    '';

  const secondary = [
    neighborhood,
    props.postcode ? `CEP ${props.postcode}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    primary: normalizeAddressText(primary),
    secondary: secondary || undefined,
  };
}

function suggestionLabel(feature: GeoapifyFeature): string {
  const props = feature.properties || {};

  return String(
    props.formatted ||
    [props.address_line1, props.address_line2]
      .filter(Boolean)
      .join(', ') ||
    '',
  ).trim();
}

function featureId(
  feature: GeoapifyFeature,
  index: number,
): string {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates;

  return String(
    props.place_id ||
    `${coords?.[1] ?? ''}:${coords?.[0] ?? ''}:${index}`,
  );
}

export async function fetchAddressSuggestions(
  input: string,
): Promise<AddressSuggestion[]> {
  const query = normalizeAddressText(input).trim();

  if (query.length < 3) return [];

  activeController?.abort();
  activeController = new AbortController();

  const params = new URLSearchParams({
    text: query,
    apiKey: getApiKey(),
    format: 'geojson',
    lang: 'pt',
    limit: '6',
    filter: `rect:${PATOS_BOUNDS.lon1},${PATOS_BOUNDS.lat1},${PATOS_BOUNDS.lon2},${PATOS_BOUNDS.lat2}`,
    bias: `proximity:${PATOS_CENTER.longitude},${PATOS_CENTER.latitude}`,
  });

  const response = await fetch(
    `${GEOAPIFY_ENDPOINT}?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: activeController.signal,
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Geoapify recusou a chave. Confira a API Key e suas restrições.',
      );
    }

    if (response.status === 429) {
      throw new Error(
        'Limite de buscas de endereço atingido temporariamente.',
      );
    }

    throw new Error(
      `Falha ao buscar endereços (${response.status}).`,
    );
  }

  const data =
    (await response.json()) as GeoapifyResponse;

  return (data.features || [])
    .filter((feature) => {
      const props = feature.properties || {};
      const countryCode =
        props.country_code?.toLowerCase();

      return !countryCode || countryCode === 'br';
    })
    .map((feature, index) => {
      const compact = compactSuggestionParts(feature);

      return {
        id: featureId(feature, index),
        label: suggestionLabel(feature),
        primary: compact.primary,
        secondary: compact.secondary,
        prediction: feature,
      };
    })
    .filter((item) => item.label)
    .slice(0, 6);
}

export async function resolveAddressSuggestion(
  suggestion: AddressSuggestion,
): Promise<ResolvedAddressSuggestion> {
  const feature = suggestion.prediction;

  if (!feature) {
    throw new Error('Sugestão de endereço inválida.');
  }

  const props = feature.properties || {};
  const { address, neighborhood, postalCode } =
    buildOperationalAddress(feature);

  const { latitude, longitude } =
    featureCoordinates(feature);

  const placeId =
    props.place_id?.trim() || undefined;

  const mapsLink =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : undefined;

  return {
    address:
      address ||
      normalizeAddressText(suggestion.label),
    formattedAddress:
      props.formatted ||
      suggestion.label,
    neighborhood,
    postalCode,
    latitude,
    longitude,
    mapsLink,
    placeId,
  };
}

export function cancelAddressAutocompleteSession() {
  activeController?.abort();
  activeController = null;
}
