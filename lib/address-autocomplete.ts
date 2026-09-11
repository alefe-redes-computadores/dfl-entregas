// lib/address-autocomplete.ts
import { loadGoogleMaps } from '@/lib/store-geocoding';
import { normalizeAddressText } from '@/lib/maps';

export interface AddressSuggestion {
  id: string;
  label: string;
  prediction: unknown;
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

const PATOS_BOUNDS = {
  west: -46.75,
  north: -18.35,
  east: -46.30,
  south: -18.82,
};

let autocompleteSessionToken: unknown | null = null;

function googleApi() {
  if (typeof window === 'undefined') {
    throw new Error('Busca de endereço indisponível neste ambiente.');
  }

  const api = (window as typeof window & { google?: any }).google;
  if (!api?.maps?.importLibrary) {
    throw new Error('Google Maps ainda não está disponível.');
  }

  return api;
}

async function placesLibrary() {
  await loadGoogleMaps();
  const api = googleApi();
  return api.maps.importLibrary('places');
}

function componentValue(
  components: any[] | undefined,
  wantedTypes: string[],
): string | undefined {
  if (!components?.length) return undefined;

  for (const type of wantedTypes) {
    const component = components.find((item) =>
      Array.isArray(item.types) && item.types.includes(type),
    );

    const value =
      component?.longText ||
      component?.long_name ||
      component?.shortText ||
      component?.short_name;

    if (value) return String(value);
  }

  return undefined;
}

function buildOperationalAddress(place: any): {
  address: string;
  neighborhood?: string;
  postalCode?: string;
} {
  const components = place.addressComponents as any[] | undefined;

  const route = componentValue(components, ['route']);
  const number = componentValue(components, ['street_number']);
  const neighborhood = componentValue(components, [
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
  ]);
  const postalCode = componentValue(components, ['postal_code']);

  if (route) {
    const street = number ? `${route}, ${number}` : route;
    return {
      address: normalizeAddressText(
        neighborhood ? `${street} - ${neighborhood}` : street,
      ),
      neighborhood,
      postalCode,
    };
  }

  const formatted = normalizeAddressText(
    String(place.formattedAddress || place.displayName || ''),
  );

  return {
    address: formatted,
    neighborhood,
    postalCode,
  };
}

export async function fetchAddressSuggestions(
  input: string,
): Promise<AddressSuggestion[]> {
  const query = normalizeAddressText(input).trim();

  if (query.length < 3) return [];

  const lib: any = await placesLibrary();

  if (!lib?.AutocompleteSuggestion || !lib?.AutocompleteSessionToken) {
    throw new Error('Places API (New) não está disponível para esta chave.');
  }

  if (!autocompleteSessionToken) {
    autocompleteSessionToken = new lib.AutocompleteSessionToken();
  }

  const request: any = {
    input: query,
    locationRestriction: PATOS_BOUNDS,
    includedRegionCodes: ['br'],
    language: 'pt-BR',
    region: 'br',
    sessionToken: autocompleteSessionToken,
  };

  const response =
    await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

  return (response?.suggestions || [])
    .map((suggestion: any) => suggestion?.placePrediction)
    .filter(Boolean)
    .slice(0, 6)
    .map((prediction: any) => ({
      id: String(
        prediction.placeId ||
        prediction.id ||
        prediction.text?.toString?.() ||
        Math.random(),
      ),
      label: String(prediction.text?.toString?.() || ''),
      prediction,
    }))
    .filter((item: AddressSuggestion) => item.label);
}

export async function resolveAddressSuggestion(
  suggestion: AddressSuggestion,
): Promise<ResolvedAddressSuggestion> {
  const prediction = suggestion.prediction as any;

  if (!prediction?.toPlace) {
    throw new Error('Sugestão de endereço inválida.');
  }

  const place = prediction.toPlace();

  await place.fetchFields({
    fields: [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'addressComponents',
    ],
  });

  const { address, neighborhood, postalCode } =
    buildOperationalAddress(place);

  const latitude =
    typeof place.location?.lat === 'function'
      ? place.location.lat()
      : place.location?.lat;

  const longitude =
    typeof place.location?.lng === 'function'
      ? place.location.lng()
      : place.location?.lng;

  const placeId = String(
    place.id ||
    prediction.placeId ||
    '',
  ).trim() || undefined;

  const mapsLink =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}${
          placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ''
        }`
      : undefined;

  // A seleção encerra a sessão atual de autocomplete.
  autocompleteSessionToken = null;

  return {
    address,
    formattedAddress: String(place.formattedAddress || suggestion.label),
    neighborhood,
    postalCode,
    latitude,
    longitude,
    mapsLink,
    placeId,
  };
}

export function cancelAddressAutocompleteSession() {
  autocompleteSessionToken = null;
}
