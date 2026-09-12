// lib/customer-identity.ts
import type { Customer } from '@/types';

const CITY_WORDS =
  /\b(?:patos de minas|minas gerais|brasil|mg|cep)\b/gi;

const STREET_ALIASES: Array<[RegExp, string]> = [
  [/\bav\.?\b/gi, 'avenida'],
  [/\baven\.?\b/gi, 'avenida'],
  [/\br\.?\b/gi, 'rua'],
  [/\btrav\.?\b/gi, 'travessa'],
  [/\btrv\.?\b/gi, 'travessa'],
  [/\bpç\.?\b/gi, 'praca'],
  [/\bpc\.?\b/gi, 'praca'],
];

export const customerBaseName = (value?: string) =>
  String(value || '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();

export const normalizeCustomerName = (value?: string) =>
  customerBaseName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeCustomerPhone = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11
    ? digits.slice(2)
    : digits;
};

export const extractHouseNumber = (value?: string) => {
  const input = String(value || '');
  const matches = [
    ...input.matchAll(
      /(?:^|[\s,;-])(\d{1,6}[A-Za-z]?)(?=$|[\s,;/-])/g,
    ),
  ];

  return matches[0]?.[1]?.toLocaleLowerCase('pt-BR') || '';
};

export const normalizeCustomerAddress = (value?: string) => {
  let normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

  for (const [pattern, replacement] of STREET_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(CITY_WORDS, ' ')
    .replace(/\b(?:n|nº|numero)\s*[:.]?\s*/g, ' ')
    .replace(/\b\d{5}-?\d{3}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const addressTokens = (value?: string) =>
  new Set(
    normalizeCustomerAddress(value)
      .split(' ')
      .filter(
        (token) =>
          token.length >= 2 &&
          ![
            'rua',
            'avenida',
            'travessa',
            'praca',
            'bairro',
            'numero',
          ].includes(token),
      ),
  );

const tokenOverlap = (a?: string, b?: string) => {
  const left = addressTokens(a);
  const right = addressTokens(b);

  if (!left.size || !right.size) return 0;

  let same = 0;

  for (const token of left) {
    if (right.has(token)) same += 1;
  }

  return same / Math.min(left.size, right.size);
};

export function sameCustomerAddress(
  a?: string,
  b?: string,
): boolean {
  const left = normalizeCustomerAddress(a);
  const right = normalizeCustomerAddress(b);

  if (!left || !right) return false;
  if (left === right) return true;

  const leftNumber = extractHouseNumber(a);
  const rightNumber = extractHouseNumber(b);

  if (
    leftNumber &&
    rightNumber &&
    leftNumber !== rightNumber
  ) {
    return false;
  }

  if (left.includes(right) || right.includes(left)) {
    return (
      !leftNumber ||
      !rightNumber ||
      leftNumber === rightNumber
    );
  }

  return (
    tokenOverlap(a, b) >= 0.72 &&
    (!leftNumber ||
      !rightNumber ||
      leftNumber === rightNumber)
  );
}

const nameTokens = (value?: string) =>
  normalizeCustomerName(value)
    .split(' ')
    .filter(Boolean);

export function customerNameSimilarity(
  a?: string,
  b?: string,
): number {
  const left = normalizeCustomerName(a);
  const right = normalizeCustomerName(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = nameTokens(left);
  const rightTokens = nameTokens(right);

  if (!leftTokens.length || !rightTokens.length) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  let same = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) same += 1;
  }

  const tokenScore =
    same / Math.max(leftSet.size, rightSet.size);

  if (
    left.includes(right) ||
    right.includes(left)
  ) {
    return Math.max(tokenScore, 0.72);
  }

  return tokenScore;
}

export interface CustomerIdentityEvidence {
  score: number;
  reusable: boolean;
  reasons: string[];
  conflicts: string[];
  exactName: boolean;
  nameSimilarity: number;
  samePhone: boolean;
  sameAddress: boolean;
}

export function customerIdentityEvidence(
  customer: Customer,
  name: string,
  details?: {
    address?: string;
    phone?: string;
  },
): CustomerIdentityEvidence {
  const reasons: string[] = [];
  const conflicts: string[] = [];

  const storedName = normalizeCustomerName(customer.name);
  const wantedName = normalizeCustomerName(name);

  const exactName =
    Boolean(storedName && wantedName) &&
    storedName === wantedName;

  const similarity = customerNameSimilarity(
    customer.name,
    name,
  );

  const storedPhone = normalizeCustomerPhone(customer.phone);
  const wantedPhone = normalizeCustomerPhone(details?.phone);

  const samePhone =
    Boolean(
      storedPhone &&
        wantedPhone &&
        storedPhone.length >= 10 &&
        wantedPhone.length >= 10,
    ) && storedPhone === wantedPhone;

  const phoneConflict =
    Boolean(
      storedPhone &&
        wantedPhone &&
        storedPhone.length >= 10 &&
        wantedPhone.length >= 10,
    ) && storedPhone !== wantedPhone;

  const storedAddress = customer.address?.trim() || '';
  const wantedAddress = details?.address?.trim() || '';

  const sameAddress =
    Boolean(storedAddress && wantedAddress) &&
    sameCustomerAddress(storedAddress, wantedAddress);

  const storedNumber = extractHouseNumber(storedAddress);
  const wantedNumber = extractHouseNumber(wantedAddress);

  const addressConflict =
    Boolean(
      storedAddress &&
        wantedAddress &&
        storedNumber &&
        wantedNumber,
    ) &&
    storedNumber !== wantedNumber;

  let score = 0;

  if (exactName) {
    score += 50;
    reasons.push('Mesmo nome');
  } else if (similarity >= 0.72) {
    score += 30;
    reasons.push('Nome muito semelhante');
  } else if (similarity >= 0.5) {
    score += 15;
    reasons.push('Nome parcialmente semelhante');
  }

  if (samePhone) {
    score += 55;
    reasons.push('Mesmo telefone');
  }

  if (sameAddress) {
    score += 50;
    reasons.push('Mesmo endereço');
  }

  if (phoneConflict) {
    score -= 60;
    conflicts.push('Telefone diferente');
  }

  if (addressConflict) {
    score -= 35;
    conflicts.push('Número do endereço diferente');
  }

  const incomingHasIdentity =
    Boolean(wantedPhone || wantedAddress);

  const storedMissingIncomingIdentity =
    Boolean(wantedPhone && !storedPhone) ||
    Boolean(wantedAddress && !storedAddress);

  const reusable =
    (
      samePhone &&
      similarity >= 0.5
    ) ||
    (
      sameAddress &&
      similarity >= 0.65 &&
      !phoneConflict
    ) ||
    (
      exactName &&
      !phoneConflict &&
      !addressConflict &&
      (
        !incomingHasIdentity ||
        storedMissingIncomingIdentity ||
        samePhone ||
        sameAddress
      )
    );

  return {
    score: Math.max(0, Math.min(100, score)),
    reusable,
    reasons,
    conflicts,
    exactName,
    nameSimilarity: similarity,
    samePhone,
    sameAddress,
  };
}

export function findExistingCustomer(
  customers: Customer[],
  name: string,
  details?: {
    address?: string;
    phone?: string;
  },
): Customer | undefined {
  const wantedName = normalizeCustomerName(name);
  if (!wantedName) return undefined;

  const ranked = customers
    .map((customer) => ({
      customer,
      evidence: customerIdentityEvidence(
        customer,
        name,
        details,
      ),
    }))
    .filter(({ evidence }) => evidence.reusable)
    .sort(
      (a, b) =>
        b.evidence.score - a.evidence.score ||
        Number(b.evidence.exactName) -
          Number(a.evidence.exactName),
    );

  return ranked[0]?.customer;
}

export function nextCustomerName(
  customers: Customer[],
  requestedName: string,
): string {
  const base = customerBaseName(requestedName);
  const wanted = normalizeCustomerName(base);

  const siblings = customers.filter(
    (customer) =>
      normalizeCustomerName(customer.name) === wanted,
  );

  if (!siblings.length) return base;

  const suffixes = siblings
    .map(
      (customer) =>
        customer.name.match(/\((\d+)\)\s*$/)?.[1],
    )
    .map((value) => Number(value || 1))
    .filter(Number.isFinite);

  const next = Math.max(1, ...suffixes) + 1;
  return `${base} (${next})`;
}

export function extractCustomerNeighborhood(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;

  const parts = raw
    .split(/\s[-–—]\s|,/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return undefined;

  const last = parts[parts.length - 1]
    .replace(
      /\b(?:patos de minas|mg|minas gerais|brasil)\b/gi,
      '',
    )
    .replace(/\d+/g, '')
    .trim();

  return last || undefined;
}
