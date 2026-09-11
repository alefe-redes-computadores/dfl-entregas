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
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
};

export const extractHouseNumber = (value?: string) => {
  const input = String(value || '');
  const matches = [...input.matchAll(/(?:^|[\s,;-])(\d{1,6}[A-Za-z]?)(?=$|[\s,;/-])/g)];
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

  normalized = normalized
    .replace(CITY_WORDS, ' ')
    .replace(/\b(?:n|nº|numero)\s*[:.]?\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
};

const addressTokens = (value?: string) =>
  new Set(
    normalizeCustomerAddress(value)
      .split(' ')
      .filter((token) =>
        token.length >= 2 &&
        !['rua', 'avenida', 'travessa', 'praca', 'bairro', 'numero'].includes(token),
      ),
  );

const overlap = (a?: string, b?: string) => {
  const left = addressTokens(a);
  const right = addressTokens(b);

  if (!left.size || !right.size) return 0;

  let same = 0;
  for (const token of left) {
    if (right.has(token)) same += 1;
  }

  return same / Math.min(left.size, right.size);
};

export function sameCustomerAddress(a?: string, b?: string): boolean {
  const left = normalizeCustomerAddress(a);
  const right = normalizeCustomerAddress(b);

  if (!left || !right) return false;
  if (left === right) return true;

  const leftNumber = extractHouseNumber(a);
  const rightNumber = extractHouseNumber(b);

  if (leftNumber && rightNumber && leftNumber !== rightNumber) return false;

  if (left.includes(right) || right.includes(left)) {
    return !leftNumber || !rightNumber || leftNumber === rightNumber;
  }

  return overlap(a, b) >= 0.72 &&
    (!leftNumber || !rightNumber || leftNumber === rightNumber);
}

export function findExistingCustomer(
  customers: Customer[],
  name: string,
  details?: { address?: string; phone?: string },
): Customer | undefined {
  const wantedName = normalizeCustomerName(name);
  if (!wantedName) return undefined;

  const candidates = customers.filter(
    (customer) => normalizeCustomerName(customer.name) === wantedName,
  );

  if (!candidates.length) return undefined;

  const wantedPhone = normalizeCustomerPhone(details?.phone);
  const wantedAddress = details?.address?.trim();

  if (wantedPhone) {
    const byPhone = candidates.find(
      (customer) =>
        normalizeCustomerPhone(customer.phone) === wantedPhone &&
        (!wantedAddress ||
          !customer.address ||
          sameCustomerAddress(customer.address, wantedAddress)),
    );
    if (byPhone) return byPhone;
  }

  if (wantedAddress) {
    const byAddress = candidates.find((customer) =>
      sameCustomerAddress(customer.address, wantedAddress),
    );
    if (byAddress) return byAddress;
  }

  if (!wantedAddress && !wantedPhone) {
    const withoutIdentity = candidates.find(
      (customer) => !customer.address && !customer.phone,
    );
    if (withoutIdentity) return withoutIdentity;
  }

  return undefined;
}

export function nextCustomerName(
  customers: Customer[],
  requestedName: string,
): string {
  const base = customerBaseName(requestedName);
  const wanted = normalizeCustomerName(base);

  const siblings = customers.filter(
    (customer) => normalizeCustomerName(customer.name) === wanted,
  );

  if (!siblings.length) return base;

  const suffixes = siblings
    .map((customer) => customer.name.match(/\((\d+)\)\s*$/)?.[1])
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
    .replace(/\b(?:patos de minas|mg|minas gerais|brasil)\b/gi, '')
    .replace(/\d+/g, '')
    .trim();

  return last || undefined;
}
