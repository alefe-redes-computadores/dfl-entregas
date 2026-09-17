// lib/address-quality.ts
import {
  canonicalizeOperationalAddress,
  hasHouseNumber,
} from '@/lib/operational-address';

export type AddressQualityIssue =
  | 'missing-address'
  | 'missing-house-number'
  | 'postal-residue'
  | 'missing-neighborhood'
  | 'neighborhood-review';

export interface AddressQualityAudit {
  address: string;
  neighborhood?: string;
  issues: AddressQualityIssue[];
  needsReview: boolean;
  label?: string;
  description?: string;
}

const normalize = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const POSTAL =
  /\b(?:CEP\s*:?\s*)?\d{5}-?\d{3}\b/i;

const postalTailLooksLikeHouseNumber = (
  rawAddress: string,
  canonicalAddress: string,
) => {
  const match = rawAddress.match(POSTAL);
  if (!match) return false;

  const digits = match[0].replace(/\D/g, '');
  if (digits.length !== 8) return false;

  const tail = digits.slice(-3);

  return new RegExp(
    `(?:^|[,\\s])${tail}(?=\\s*(?:$|[-,/]))`,
  ).test(canonicalAddress);
};

export function knownOperationalNeighborhoods(
  values: Array<string | null | undefined>,
): string[] {
  return unique(
    values.flatMap((value) => {
      if (!value?.trim()) return [];

      const canonical =
        canonicalizeOperationalAddress(value);

      return canonical.neighborhood
        ? [canonical.neighborhood]
        : [];
    }),
  );
}

export function auditOperationalAddress(
  rawAddress?: string,
  options: {
    fallbackNeighborhood?: string;
    knownNeighborhoods?: string[];
  } = {},
): AddressQualityAudit {
  const raw = rawAddress?.trim() || '';

  const canonical = canonicalizeOperationalAddress(
    raw,
    options.fallbackNeighborhood,
  );

  const address = canonical.address.trim();
  const neighborhood = canonical.neighborhood?.trim();
  const issues: AddressQualityIssue[] = [];

  if (!address) {
    issues.push('missing-address');
  } else {
    if (!hasHouseNumber(address)) {
      issues.push('missing-house-number');
    }

    if (
      POSTAL.test(address) ||
      postalTailLooksLikeHouseNumber(raw, address)
    ) {
      issues.push('postal-residue');
    }

    if (!neighborhood) {
      issues.push('missing-neighborhood');
    }
  }

  const known = unique(
    options.knownNeighborhoods || [],
  );

  /*
   * Não inventamos bairro.
   *
   * Centro é bairro legítimo. Só pedimos revisão quando:
   * - o endereço terminou como Centro;
   * - existem bairros operacionais conhecidos;
   * - e o texto bruto contém outro bairro conhecido.
   *
   * Isso captura contaminação evidente sem transformar "Centro"
   * em erro global.
   */
  if (
    normalize(neighborhood) === 'centro' &&
    known.length
  ) {
    const rawNormalized = normalize(raw);

    const anotherKnownNeighborhood =
      known.find((candidate) => {
        const normalizedCandidate = normalize(candidate);

        return (
          normalizedCandidate &&
          normalizedCandidate !== 'centro' &&
          rawNormalized.includes(normalizedCandidate)
        );
      });

    if (anotherKnownNeighborhood) {
      issues.push('neighborhood-review');
    }
  }

  let label: string | undefined;
  let description: string | undefined;

  if (issues.includes('missing-address')) {
    label = 'Endereço ausente';
    description =
      'Abra a entrega e informe o endereço antes da saída.';
  } else if (issues.includes('postal-residue')) {
    label = 'Confira o número';
    description =
      'O endereço ainda parece misturar CEP e número residencial.';
  } else if (issues.includes('missing-house-number')) {
    label = 'Sem número confiável';
    description =
      'Confira o número da casa antes de concluir a entrega.';
  } else if (issues.includes('neighborhood-review')) {
    label = 'Confira o bairro';
    description =
      'O endereço terminou como Centro, mas há outro bairro conhecido no texto.';
  } else if (issues.includes('missing-neighborhood')) {
    label = 'Bairro não identificado';
    description =
      'Confira o bairro ou mantenha um link confiável do Maps.';
  }

  return {
    address,
    neighborhood,
    issues,
    needsReview: issues.length > 0,
    label,
    description,
  };
}
