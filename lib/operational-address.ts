// lib/operational-address.ts

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

const PHONE =
  /(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}/;

const COMPLEMENT =
  /\b(?:ap(?:to|artamento)?\.?|bloco|casa\s+(?:azul|verde|amarela|branca|preta|cinza|rosa)|casa\s+de\s+esquina|fundos|andar|sala|port[aã]o|interfone|entrada|esquina|em frente|ao lado|pr[oó]ximo|refer[eê]ncia|condom[ií]nio|tocar|buzinar|ligar|chamar)\b/i;

const GEO_NOISE =
  /^(?:patos de minas|minas gerais|mg|brasil|brazil)$/i;

const meaningfulStreetLength = (value: string) =>
  (value.match(/[A-Za-zÀ-ÿ]/g) || []).length;

const dedupe = (items: string[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizeToken(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const stripGeoNoise = (value: string) =>
  compactWhitespace(value)
    .replace(/\bCEP\s*:?\s*\d{5}-?\d{3}\b/gi, ' ')
    .replace(/,?\s*Patos de Minas\s*(?:[-/,]\s*MG)?\b/gi, ' ')
    .replace(/,?\s*Minas Gerais\b/gi, ' ')
    .replace(/,?\s*Brasil\b/gi, ' ')
    .replace(/,?\s*Brazil\b/gi, ' ')
    .replace(/,?\s*MG\b(?=\s*(?:$|-|,))/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim();

const streetQuality = (value?: string) => {
  const address = compactWhitespace(value);
  if (!address) return -1000;

  let score = meaningfulStreetLength(address);
  if (hasHouseNumber(address)) score += 35;

  const first = normalizeToken(
    address.split(/\s+-\s+|,/)[0],
  );

  if (
    /^(r|rua|av|avenida|trav|travessa)$/.test(
      first,
    )
  ) {
    score -= 50;
  }

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

export interface CanonicalOperationalAddress {
  address: string;
  neighborhood?: string;
  phone?: string;
  observations: string[];
}

export function hasHouseNumber(
  value?: string,
): boolean {
  const address = compactWhitespace(value);
  if (!address) return false;

  return /(?:^|[\s,;-])\d{1,6}[A-Za-z]?(?:\s|$|[,;/.-])/i.test(
    `${address} `,
  );
}

export function canonicalizeOperationalAddress(
  raw?: string,
  fallbackNeighborhood?: string,
): CanonicalOperationalAddress {
  let source = compactWhitespace(raw);

  if (!source) {
    return {
      address: compactWhitespace(
        fallbackNeighborhood,
      ),
      neighborhood:
        compactWhitespace(
          fallbackNeighborhood,
        ) || undefined,
      observations: [],
    };
  }

  const phoneMatch = source.match(PHONE);
  const phone = phoneMatch
    ? phoneMatch[0].replace(/\D/g, '')
    : undefined;

  if (
    phone &&
    phone.length >= 10 &&
    phone.length <= 11
  ) {
    source = source.replace(PHONE, ' ');
  }

  source = stripGeoNoise(source);

  const observations: string[] = [];

  let parts = source
    .split(/\s+-\s+/)
    .map((part) => compactWhitespace(part))
    .filter(Boolean);

  parts = parts.filter((part) => {
    if (GEO_NOISE.test(normalizeToken(part))) {
      return false;
    }

    if (COMPLEMENT.test(part)) {
      observations.push(part);
      return false;
    }

    return true;
  });

  let street = parts.shift() || '';

  // Complemento pode vir grudado ao endereço:
  // "Rua X, 10, Apto 3".
  const commaParts = street
    .split(/\s*,\s*/)
    .filter(Boolean);

  if (commaParts.length > 2) {
    const addressParts: string[] = [];

    for (const part of commaParts) {
      if (COMPLEMENT.test(part)) {
        observations.push(part);
      } else if (
        !GEO_NOISE.test(normalizeToken(part))
      ) {
        addressParts.push(part);
      }
    }

    street = addressParts
      .slice(0, 2)
      .join(', ');

    parts = [
      ...addressParts.slice(2),
      ...parts,
    ];
  }

  const fallback =
    compactWhitespace(fallbackNeighborhood);

  let neighborhood = '';

  for (const part of parts) {
    if (COMPLEMENT.test(part)) {
      observations.push(part);
      continue;
    }

    const clean = part
      .replace(/^bairro\s+/i, '')
      .trim();

    if (
      !clean ||
      GEO_NOISE.test(normalizeToken(clean))
    ) {
      continue;
    }

    if (!neighborhood) {
      neighborhood = clean;
    } else {
      observations.push(clean);
    }
  }

  neighborhood ||= fallback;

  street = stripGeoNoise(street)
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/[,\s-]+$/g, '')
    .trim();

  let address = street;

  if (
    neighborhood &&
    !normalizeToken(address).includes(
      normalizeToken(neighborhood),
    )
  ) {
    address = address
      ? `${address} - ${neighborhood}`
      : neighborhood;
  }

  address = dedupeSegments(address);

  return {
    address,
    neighborhood:
      neighborhood || undefined,
    phone:
      phone &&
      phone.length >= 10 &&
      phone.length <= 11
        ? phone
        : undefined,
    observations: dedupe(
      observations
        .map((item) =>
          stripGeoNoise(item),
        )
        .filter(Boolean),
    ),
  };
}

export function bestOperationalAddress(
  deliveryAddress?: string,
  customerAddress?: string,
): string {
  const delivery =
    canonicalizeOperationalAddress(
      deliveryAddress,
    ).address;

  const customer =
    canonicalizeOperationalAddress(
      customerAddress,
    ).address;

  if (!delivery) return customer;
  if (!customer) return delivery;

  const deliveryHasNumber =
    hasHouseNumber(delivery);

  const customerHasNumber =
    hasHouseNumber(customer);

  if (
    !deliveryHasNumber &&
    customerHasNumber
  ) {
    return customer;
  }

  if (
    deliveryHasNumber &&
    !customerHasNumber
  ) {
    return delivery;
  }

  return (
    streetQuality(customer) >
    streetQuality(delivery) + 8
      ? customer
      : delivery
  );
}

export function compactAddressForCard(
  deliveryAddress?: string,
  customerAddress?: string,
  neighborhood?: string,
): string {
  const best = bestOperationalAddress(
    deliveryAddress,
    customerAddress,
  );

  return canonicalizeOperationalAddress(
    best,
    neighborhood,
  ).address;
}
