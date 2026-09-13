// lib/operational-address.ts
//
// V3 — normalização conservadora.
// Regra principal: na dúvida, preservar o texto em vez de reclassificar.
// CEP, telefone e número residencial são domínios independentes.

const compactWhitespace = (value?: string) =>
  String(value || '')
    .replace(/\r?\n+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*[-–—]\s*/g, ' - ')
    .trim();

const normalizeToken = (value?: string) =>
  compactWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[.,]/g, '')
    .trim();

const PHONE = /(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}/;
const POSTAL = /\b(?:CEP\s*:?\s*)?(\d{5})-?(\d{3})\b/i;

const STRONG_COMPLEMENT =
  /^(?:obs(?:erva(?:ç|c)[aã]o)?|refer[eê]ncia|complemento|instru(?:ç|c)[aã]o)\s*:|^(?:ap(?:to|artamento)?\.?\s*\w*|bloco\s+\w+|fundos\b|andar\b|sala\b|port[aã]o\b|interfone\b|entrada\b|casa\b|casa\s+de\s+esquina\b|em frente\b|ao lado\b|pr[oó]ximo\b|tocar\b|buzinar\b|ligar\b|chamar\b)/i;

const GEO_NOISE_EXACT =
  /^(?:patos de minas|minas gerais|mg|brasil|brazil)$/i;

const STREET_PREFIX =
  /^(?:r\.?|rua|av\.?|avenida|alameda|trav(?:essa)?\.?|pra[cç]a|rodovia|estrada|beco|viela)\b/i;

const dedupe = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeToken(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const stripKnownGeoNoise = (value: string) =>
  compactWhitespace(value)
    .replace(/,?\s*Patos de Minas\s*(?:[-/,]\s*MG)?\b/gi, ' ')
    .replace(/,?\s*Minas Gerais\b/gi, ' ')
    .replace(/,?\s*Brasil\b/gi, ' ')
    .replace(/,?\s*Brazil\b/gi, ' ')
    .replace(/,?\s*MG\b(?=\s*(?:$|-|,))/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim();

const cleanObservation = (value: string) =>
  stripKnownGeoNoise(value)
    .replace(POSTAL, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim();

const meaningfulStreetLength = (value: string) =>
  (value.match(/[A-Za-zÀ-ÿ]/g) || []).length;

const streetQuality = (value?: string) => {
  const address = compactWhitespace(value);
  if (!address) return -1000;
  let score = meaningfulStreetLength(address);
  if (hasHouseNumber(address)) score += 35;
  if (STREET_PREFIX.test(address)) score += 12;
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
  return dedupe(parts).join(' - ');
};

function isStrongNeighborhood(value: string) {
  const clean = value.replace(/^bairro\s+/i, '').trim();
  if (!clean || GEO_NOISE_EXACT.test(normalizeToken(clean))) return false;
  if (STRONG_COMPLEMENT.test(clean)) return false;
  if (POSTAL.test(clean) || PHONE.test(clean)) return false;
  if (/^\d[\d\s.-]*$/.test(clean)) return false;
  return /[A-Za-zÀ-ÿ]{3}/.test(clean);
}

function removePostalAndPhone(source: string) {
  let value = source;
  let postalCode: string | undefined;
  let phone: string | undefined;

  const postalMatch = value.match(POSTAL);
  if (postalMatch) {
    postalCode = `${postalMatch[1]}-${postalMatch[2]}`;
    value = value.replace(POSTAL, ' ');
  }

  const phoneMatch = value.match(PHONE);
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 11) {
      phone = digits;
      value = value.replace(PHONE, ' ');
    }
  }

  return {
    source: compactWhitespace(value),
    postalCode,
    phone,
  };
}

export interface CanonicalOperationalAddress {
  address: string;
  neighborhood?: string;
  phone?: string;
  postalCode?: string;
  observations: string[];
}

export function hasHouseNumber(value?: string): boolean {
  const address = compactWhitespace(value);
  if (!address) return false;

  // O CEP é removido antes da inspeção para nunca virar número residencial.
  const withoutPostal = address.replace(POSTAL, ' ');

  return /(?:,\s*|\s)\d{1,5}[A-Za-z]?(?=\s*(?:$|[-,/]))/i.test(
    withoutPostal,
  );
}

export function canonicalizeOperationalAddress(
  raw?: string,
  fallbackNeighborhood?: string,
): CanonicalOperationalAddress {
  const original = compactWhitespace(raw);
  const fallback = compactWhitespace(fallbackNeighborhood);

  if (!original) {
    return {
      address: fallback,
      neighborhood: fallback || undefined,
      observations: [],
    };
  }

  const extracted = removePostalAndPhone(original);
  let source = stripKnownGeoNoise(extracted.source);

  const observations: string[] = [];

  // Primeiro tratamos apenas separadores fortes. Fragmentos ambíguos
  // permanecem no endereço; eles não são despejados em observação.
  const dashParts = source
    .split(/\s+-\s+/)
    .map((part) => compactWhitespace(part))
    .filter(Boolean)
    .filter((part) => !GEO_NOISE_EXACT.test(normalizeToken(part)));

  let street = dashParts.shift() || '';
  const trailing = dashParts;

  // Complementos por vírgula só são removidos quando têm marcador forte.
  const commaParts = street.split(/\s*,\s*/).filter(Boolean);
  if (commaParts.length > 2) {
    const kept: string[] = [];
    for (const part of commaParts) {
      if (STRONG_COMPLEMENT.test(part)) {
        observations.push(part);
      } else if (!GEO_NOISE_EXACT.test(normalizeToken(part))) {
        kept.push(part);
      }
    }
    street = kept.join(', ');
  }

  let neighborhood = fallback;

  for (const part of trailing) {
    if (STRONG_COMPLEMENT.test(part)) {
      observations.push(part);
      continue;
    }

    const explicitNeighborhood = /^bairro\s+/i.test(part);
    const clean = part.replace(/^bairro\s+/i, '').trim();

    if (!neighborhood && (explicitNeighborhood || isStrongNeighborhood(clean))) {
      neighborhood = clean;
      continue;
    }

    // Se já existe bairro conhecido, um fragmento desconhecido NÃO vira
    // observação automaticamente. Preservamos no endereço.
    if (clean && !GEO_NOISE_EXACT.test(normalizeToken(clean))) {
      street = street ? `${street} - ${clean}` : clean;
    }
  }

  street = stripKnownGeoNoise(street)
    .replace(POSTAL, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/[,\s-]+$/g, '')
    .trim();

  let address = street;

  if (
    neighborhood &&
    !normalizeToken(address).includes(normalizeToken(neighborhood))
  ) {
    address = address ? `${address} - ${neighborhood}` : neighborhood;
  }

  address = dedupeSegments(address);

  // Invariante: jamais permitir que os três últimos dígitos do CEP
  // apareçam como novo "número" por transformação.
  if (extracted.postalCode) {
    const cepTail = extracted.postalCode.slice(-3);
    const originalWithoutPostal = original.replace(POSTAL, ' ');
    const originalHadCepTailAsHouse =
      new RegExp(`(?:,\\s*|\\s)${cepTail}(?=\\s*(?:$|[-,/]))`).test(
        originalWithoutPostal,
      );

    if (
      !originalHadCepTailAsHouse &&
      new RegExp(`(?:,\\s*|\\s)${cepTail}(?=\\s*(?:$|[-,/]))`).test(address)
    ) {
      address = stripKnownGeoNoise(original.replace(POSTAL, ' '));
    }
  }

  return {
    address: compactWhitespace(address),
    neighborhood: neighborhood || undefined,
    phone: extracted.phone,
    postalCode: extracted.postalCode,
    observations: dedupe(
      observations.map(cleanObservation).filter(Boolean),
    ),
  };
}

export function bestOperationalAddress(
  deliveryAddress?: string,
  customerAddress?: string,
): string {
  const delivery = canonicalizeOperationalAddress(deliveryAddress).address;
  const customer = canonicalizeOperationalAddress(customerAddress).address;

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
  const best = bestOperationalAddress(deliveryAddress, customerAddress);
  return canonicalizeOperationalAddress(best, neighborhood).address;
}
