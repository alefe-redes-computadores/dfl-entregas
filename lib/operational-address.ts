// lib/operational-address.ts

const compactWhitespace = (value?: string) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*-\s*/g, ' - ')
    .trim();

const normalizeToken = (value?: string) =>
  compactWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[.,]/g, '')
    .trim();

const meaningfulStreetLength = (value: string) =>
  (value.match(/[A-Za-zÀ-ÿ]/g) || []).length;

const streetQuality = (value?: string) => {
  const address = compactWhitespace(value);
  if (!address) return -1000;

  let score = meaningfulStreetLength(address);
  if (hasHouseNumber(address)) score += 35;

  const first = normalizeToken(address.split(/\s+-\s+|,/)[0]);
  if (/^(r|rua|av|avenida|trav|travessa)$/.test(first)) score -= 50;
  if (/^(r|av)\s*$/.test(first)) score -= 60;

  score += Math.min(address.length, 100) / 10;
  return score;
};

const dedupeSegments = (value?: string) => {
  const address = compactWhitespace(value);
  if (!address) return '';

  const parts = address
    .split(/\s+-\s+/)
    .map((part) => compactWhitespace(part))
    .filter(Boolean);

  const result: string[] = [];
  for (const part of parts) {
    const normalized = normalizeToken(part);
    if (!normalized) continue;

    const previous = result[result.length - 1];
    if (previous && normalizeToken(previous) === normalized) continue;

    result.push(part);
  }

  return result.join(' - ');
};

export function hasHouseNumber(value?: string): boolean {
  const address = compactWhitespace(value);
  if (!address) return false;

  return /(?:^|[\s,;-])\d{1,6}[A-Za-z]?(?:\s|$|[,;/.-])/i.test(`${address} `);
}

export function bestOperationalAddress(
  deliveryAddress?: string,
  customerAddress?: string,
): string {
  const delivery = dedupeSegments(deliveryAddress);
  const customer = dedupeSegments(customerAddress);

  if (!delivery) return customer;
  if (!customer) return delivery;

  const deliveryHasNumber = hasHouseNumber(delivery);
  const customerHasNumber = hasHouseNumber(customer);

  if (!deliveryHasNumber && customerHasNumber) return customer;
  if (deliveryHasNumber && !customerHasNumber) return delivery;

  return streetQuality(customer) > streetQuality(delivery) + 8
    ? customer
    : delivery;
}

export function compactAddressForCard(
  deliveryAddress?: string,
  customerAddress?: string,
  neighborhood?: string,
): string {
  let address = bestOperationalAddress(deliveryAddress, customerAddress);
  if (!address) return compactWhitespace(neighborhood);

  address = dedupeSegments(address);

  const neighborhoodToken = normalizeToken(neighborhood);
  if (neighborhoodToken) {
    const parts = address.split(/\s+-\s+/).filter(Boolean);
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const part of parts) {
      const token = normalizeToken(part);
      if (!token) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      deduped.push(part);
    }

    address = deduped.join(' - ');

    const addressTokens = deduped.map(normalizeToken);
    if (!addressTokens.includes(neighborhoodToken)) {
      address = `${address} - ${compactWhitespace(neighborhood)}`;
    }
  }

  return address;
}
