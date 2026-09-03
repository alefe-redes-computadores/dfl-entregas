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
 * Higieniza o endereço focando na entrega em Patos de Minas
 * Prioriza "Rua/Av, Número, Patos de Minas - MG" ignorando ruídos
 */
export function cleanAddressForMaps(rawAddress: string): string {
  if (!rawAddress) return 'Patos de Minas, MG';

  const clean = rawAddress.replace(/[#&+\|]/g, ' ').replace(/\s+/g, ' ').trim();

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
