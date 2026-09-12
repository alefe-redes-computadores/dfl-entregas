#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/storage/shared/Documents/dfl-entregas

EXPECTED_HEAD="6c799ecfc670c95c20d75ae5278154c4186e9e22"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia4-ifood-clientes-${STAMP}"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 4"
echo " CLIENTES + IFOOD PÓS-ROTA V1"
echo "============================================================"

echo
echo "== 1/8 PRE-FLIGHT =="

[ "$(pwd)" = "$HOME/storage/shared/Documents/dfl-entregas" ] || {
  echo "ABORTADO: diretório incorreto: $(pwd)"
  exit 1
}

CURRENT_HEAD="$(git rev-parse HEAD)"
[ "$CURRENT_HEAD" = "$EXPECTED_HEAD" ] || {
  echo "ABORTADO: HEAD divergente."
  echo "Esperado: $EXPECTED_HEAD"
  echo "Atual:    $CURRENT_HEAD"
  exit 1
}

FILES=(
  "lib/customer-identity.ts"
  "lib/customer-duplicates.ts"
  "components/deliveries/CustomerAutocomplete.tsx"
  "store/useAppStore.ts"
  "app/entregas/nova/page.tsx"
  "app/confirmacoes/page.tsx"
  "app/confirmar/page.tsx"
  "components/home/RouteAccordion.tsx"
)

for file in "${FILES[@]}"; do
  [ -f "$file" ] || {
    echo "ABORTADO: arquivo ausente: $file"
    exit 1
  }
done

git diff --quiet || {
  echo "ABORTADO: existem alterações TRACKED não commitadas."
  git status --short
  exit 1
}

git diff --cached --quiet || {
  echo "ABORTADO: existem alterações staged."
  git status --short
  exit 1
}

echo "Pre-flight: OK"
echo "HEAD: $(git log -1 --oneline)"

echo
echo "== 2/8 BACKUP =="

mkdir -p "$BACKUP"

for file in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp "$file" "$BACKUP/$file"
done

echo "Backup: $BACKUP"

echo
echo "== 3/8 IDENTIDADE DE CLIENTES =="

python <<'PY'
from pathlib import Path

p = Path("lib/customer-identity.ts")

p.write_text(r"""// lib/customer-identity.ts
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
""")

print("customer-identity.ts: OK")
PY

python <<'PY'
from pathlib import Path

p = Path("lib/customer-duplicates.ts")

p.write_text(r"""// lib/customer-duplicates.ts
import type { Customer, Delivery } from '@/types';
import {
  customerIdentityEvidence,
  customerNameSimilarity,
  normalizeCustomerPhone,
  sameCustomerAddress,
} from '@/lib/customer-identity';

export interface CustomerDuplicateCandidate {
  left: Customer;
  right: Customer;
  score: number;
  reasons: string[];
  leftOrders: number;
  rightOrders: number;
}

export function customerDuplicateCandidates(
  customers: Customer[],
  deliveries: Delivery[],
): CustomerDuplicateCandidate[] {
  const orderCounts = new Map<string, number>();

  deliveries.forEach((delivery) => {
    if (!delivery.customer_id) return;

    orderCounts.set(
      delivery.customer_id,
      (orderCounts.get(delivery.customer_id) || 0) + 1,
    );
  });

  const result: CustomerDuplicateCandidate[] = [];

  for (let i = 0; i < customers.length; i += 1) {
    for (let j = i + 1; j < customers.length; j += 1) {
      const left = customers[i];
      const right = customers[j];

      const leftToRight = customerIdentityEvidence(
        left,
        right.name,
        {
          address: right.address,
          phone: right.phone,
        },
      );

      const rightToLeft = customerIdentityEvidence(
        right,
        left.name,
        {
          address: left.address,
          phone: left.phone,
        },
      );

      const similarity = customerNameSimilarity(
        left.name,
        right.name,
      );

      const leftPhone = normalizeCustomerPhone(left.phone);
      const rightPhone = normalizeCustomerPhone(right.phone);

      const samePhone =
        Boolean(
          leftPhone &&
            rightPhone &&
            leftPhone.length >= 10 &&
            rightPhone.length >= 10,
        ) && leftPhone === rightPhone;

      const sameAddress =
        Boolean(left.address && right.address) &&
        sameCustomerAddress(
          left.address,
          right.address,
        );

      const probable =
        leftToRight.reusable ||
        rightToLeft.reusable ||
        samePhone ||
        (sameAddress && similarity >= 0.65);

      if (!probable) continue;

      const reasons = Array.from(
        new Set([
          ...leftToRight.reasons,
          ...rightToLeft.reasons,
          ...(samePhone ? ['Mesmo telefone'] : []),
          ...(sameAddress ? ['Mesmo endereço'] : []),
        ]),
      );

      const score = Math.max(
        leftToRight.score,
        rightToLeft.score,
        samePhone && sameAddress ? 100 : 0,
      );

      result.push({
        left,
        right,
        score,
        reasons,
        leftOrders: orderCounts.get(left.id) || 0,
        rightOrders: orderCounts.get(right.id) || 0,
      });
    }
  }

  return result.sort(
    (a, b) =>
      b.score - a.score ||
      b.leftOrders +
        b.rightOrders -
        (a.leftOrders + a.rightOrders),
  );
}
""")

print("customer-duplicates.ts: OK")
PY

python <<'PY'
from pathlib import Path

p = Path("components/deliveries/CustomerAutocomplete.tsx")

p.write_text(r"""'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MapPin,
  Phone,
  User,
} from 'lucide-react';

import type { Customer } from '@/types';
import {
  normalizeCustomerAddress,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from '@/lib/customer-identity';

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (customer: Customer) => void;
  customers: Customer[];
}

export function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  customers,
}: CustomerAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] =
    useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const nameQuery = normalizeCustomerName(value);
    const phoneQuery = normalizeCustomerPhone(value);
    const addressQuery = normalizeCustomerAddress(value);

    if (
      !nameQuery &&
      phoneQuery.length < 3 &&
      !addressQuery
    ) {
      return [];
    }

    return customers
      .map((customer) => {
        const customerName = normalizeCustomerName(
          customer.name,
        );

        const customerPhone = normalizeCustomerPhone(
          customer.phone,
        );

        const customerAddress =
          normalizeCustomerAddress(customer.address);

        let score = 0;

        if (nameQuery) {
          if (customerName === nameQuery) score += 100;
          else if (customerName.startsWith(nameQuery))
            score += 70;
          else if (customerName.includes(nameQuery))
            score += 50;
        }

        if (
          phoneQuery.length >= 3 &&
          customerPhone.includes(phoneQuery)
        ) {
          score += 80;
        }

        if (
          addressQuery.length >= 4 &&
          customerAddress.includes(addressQuery)
        ) {
          score += 30;
        }

        return { customer, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.customer.name.localeCompare(
            b.customer.name,
            'pt-BR',
          ),
      )
      .slice(0, 6)
      .map((item) => item.customer);
  }, [customers, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
  }, []);

  function handleSelect(customer: Customer) {
    onChange(customer.name);
    onSelect?.(customer);
    setShowSuggestions(false);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col gap-2"
    >
      <label className="text-sm font-semibold text-zinc-400">
        Nome do Cliente
      </label>

      <div className="relative">
        <User
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />

        <input
          type="text"
          placeholder="Ex: João Silva ou (34) 9..."
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-emerald-500 focus:outline-none"
          autoComplete="off"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full z-30 mt-1 max-h-72 w-full divide-y divide-zinc-800/60 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          {suggestions.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => handleSelect(customer)}
              className="flex w-full flex-col px-4 py-3 text-left transition-colors active:bg-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-zinc-100">
                  {customer.name}
                </span>

                {customer.phone && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <Phone size={10} />
                    {customer.phone}
                  </span>
                )}
              </div>

              {customer.address && (
                <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-400">
                  <MapPin
                    size={11}
                    className="shrink-0 text-zinc-500"
                  />
                  {customer.address}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
""")

print("CustomerAutocomplete.tsx: OK")
PY

echo
echo "== 4/8 STORE — CLIENTE + FILA IFOOD =="

python <<'PY'
from pathlib import Path

p = Path("store/useAppStore.ts")
s = p.read_text()

def once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: esperado 1 trecho, encontrado {s.count(old)}"
        )
    s = s.replace(old, new, 1)

old_signature = """  findOrCreateCustomer: (name: string, details?: { address?: string; phone?: string; mapsLink?: string; confirmationCode?: string; observation?: string; origin?: OrderOrigin; }) => Promise<string>;"""

new_signature = """  findOrCreateCustomer: (
    name: string,
    details?: {
      address?: string;
      phone?: string;
      mapsLink?: string;
      confirmationCode?: string;
      observation?: string;
      origin?: OrderOrigin;
      preferredCustomerId?: string;
    },
  ) => Promise<string>;"""

once(
    old_signature,
    new_signature,
    "contrato findOrCreateCustomer",
)

start = s.find(
    "      addIfoodPendingConfirmations: async (items) => {"
)

end = s.find(
    "      updateIfoodPendingConfirmation: async (id, data) => {",
    start,
)

if start < 0 or end < 0:
    raise SystemExit(
        "ABORTADO: bloco addIfoodPendingConfirmations não localizado."
    )

new_pending = r"""      addIfoodPendingConfirmations: async (items) => {
        if (!items.length) return;

        const previous = get().ifoodPendingConfirmations;
        const normalizeDigits = (value?: string) =>
          (value || '').replace(/\D/g, '');

        const samePendingIdentity = (
          left: IfoodPendingConfirmation,
          right: IfoodPendingConfirmation,
        ) => {
          const leftDelivery = left.delivery_id?.trim();
          const rightDelivery = right.delivery_id?.trim();

          if (
            leftDelivery &&
            rightDelivery &&
            leftDelivery === rightDelivery
          ) {
            return true;
          }

          const leftIfood = normalizeDigits(left.ifood_id);
          const rightIfood = normalizeDigits(right.ifood_id);

          if (
            leftIfood &&
            rightIfood &&
            leftIfood === rightIfood
          ) {
            return true;
          }

          const leftOrder = normalizeDigits(left.order_id);
          const rightOrder = normalizeDigits(right.order_id);

          if (
            !leftIfood &&
            !rightIfood &&
            leftOrder &&
            rightOrder &&
            leftOrder === rightOrder
          ) {
            if (
              left.route_id &&
              right.route_id &&
              left.route_id !== right.route_id
            ) {
              return false;
            }

            return true;
          }

          return false;
        };

        const working = [...previous];
        const changed = new Map<
          string,
          IfoodPendingConfirmation
        >();

        for (const incoming of items) {
          const duplicateInsideBatch = [
            ...changed.values(),
          ].find((item) =>
            samePendingIdentity(item, incoming),
          );

          if (duplicateInsideBatch) {
            continue;
          }

          const existingIndex = working.findIndex(
            (item) =>
              samePendingIdentity(item, incoming),
          );

          if (existingIndex >= 0) {
            const existing = working[existingIndex];
            const resolved =
              existing.status === 'resolved';

            const merged: IfoodPendingConfirmation = {
              ...existing,

              order_id:
                incoming.order_id ||
                existing.order_id,

              ifood_id:
                incoming.ifood_id ||
                existing.ifood_id,

              confirmation_code:
                incoming.confirmation_code ||
                existing.confirmation_code,

              customer_name:
                incoming.customer_name ||
                existing.customer_name,

              value:
                incoming.value ??
                existing.value,

              note:
                incoming.note ||
                existing.note,

              delivery_id:
                incoming.delivery_id ||
                existing.delivery_id,

              route_id:
                incoming.route_id ||
                existing.route_id,

              route_name:
                incoming.route_name ||
                existing.route_name,

              source_kind:
                incoming.source_kind === 'route'
                  ? 'route'
                  : existing.source_kind ||
                    incoming.source_kind,

              status: resolved
                ? 'resolved'
                : existing.status ||
                  incoming.status ||
                  'pending',

              resolved_at: resolved
                ? existing.resolved_at
                : existing.resolved_at,

              created_at:
                existing.created_at ||
                incoming.created_at,

              updated_at: new Date().toISOString(),
            };

            working[existingIndex] = merged;
            changed.set(merged.id, merged);
            continue;
          }

          const created: IfoodPendingConfirmation = {
            ...incoming,
            status: incoming.status || 'pending',
            updated_at:
              incoming.updated_at ||
              new Date().toISOString(),
          };

          working.unshift(created);
          changed.set(created.id, created);
        }

        if (!changed.size) return;

        set({
          ifoodPendingConfirmations: working,
        });

        try {
          const batch = writeBatch(db);

          changed.forEach((item) => {
            batch.set(
              doc(
                db,
                'ifood_pending_confirmations',
                item.id,
              ),
              sanitizeForFirebase(item),
              { merge: true },
            );
          });

          await batch.commit();
        } catch (error) {
          set({
            ifoodPendingConfirmations: previous,
          });

          console.error(
            'Erro ao consolidar fila de confirmações iFood:',
            error,
          );

          throw error;
        }
      },

"""

s = s[:start] + new_pending + s[end:]

start = s.find(
    "      findOrCreateCustomer: async (name, details) => {"
)

end_marker = "\n      },\n    }),"
end = s.find(end_marker, start)

if start < 0 or end < 0:
    raise SystemExit(
        "ABORTADO: bloco findOrCreateCustomer não localizado."
    )

new_customer = r"""      findOrCreateCustomer: async (name, details) => {
        const rawName = name.trim();
        if (!rawName) return '';

        const previousCustomers = get().customers;
        const now = new Date().toISOString();

        const preferredCustomer =
          details?.preferredCustomerId
            ? previousCustomers.find(
                (customer) =>
                  customer.id ===
                  details.preferredCustomerId,
              )
            : undefined;

        const existing =
          preferredCustomer ||
          findExistingCustomer(
            previousCustomers,
            rawName,
            {
              address: details?.address,
              phone: details?.phone,
            },
          );

        const derivedNeighborhood =
          extractCustomerNeighborhood(
            details?.address,
          );

        const enrichExisting = async (
          customer: Customer,
        ) => {
          const before = { ...customer };

          const updatedFields: Partial<Customer> = {
            updated_at: now,
          };

          /*
           * Cadastro selecionado/reutilizado é enriquecido.
           * Campo vazio nunca apaga dado bom já existente.
           */
          if (details?.address?.trim()) {
            updatedFields.address =
              details.address.trim();
          }

          if (details?.mapsLink?.trim()) {
            updatedFields.maps_link =
              details.mapsLink.trim();
          }

          if (details?.confirmationCode?.trim()) {
            updatedFields.last_confirmation_code =
              details.confirmationCode.trim();
          }

          if (details?.observation?.trim()) {
            updatedFields.observation =
              details.observation.trim();
          }

          if (derivedNeighborhood) {
            updatedFields.neighborhood =
              derivedNeighborhood;
          }

          if (details?.origin) {
            updatedFields.origin = details.origin;
          }

          if (details?.phone?.trim()) {
            updatedFields.phone =
              details.phone.trim();
          }

          set((state) => ({
            customers: state.customers.map(
              (current) =>
                current.id === customer.id
                  ? {
                      ...current,
                      ...updatedFields,
                    }
                  : current,
            ),
          }));

          try {
            await updateDoc(
              doc(db, 'customers', customer.id),
              sanitizeForFirebase(updatedFields),
            );
          } catch (error) {
            set((state) => ({
              customers: state.customers.map(
                (current) =>
                  current.id === customer.id
                    ? before
                    : current,
              ),
            }));

            console.error(
              'Erro ao atualizar cliente existente:',
              error,
            );

            throw error;
          }

          return customer.id;
        };

        if (existing) {
          return enrichExisting(existing);
        }

        /*
         * Segunda leitura do estado é importante:
         * outra criação pode ter inserido o cliente enquanto
         * esta operação ainda preparava os dados.
         */
        const rechecked = findExistingCustomer(
          get().customers,
          rawName,
          {
            address: details?.address,
            phone: details?.phone,
          },
        );

        if (rechecked) {
          return enrichExisting(rechecked);
        }

        const currentCustomers = get().customers;

        const customerName = nextCustomerName(
          currentCustomers,
          rawName,
        );

        const newCustomer: Customer = {
          id: `customer-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,

          name: customerName,
          origin: details?.origin || 'loja',
          neighborhood: derivedNeighborhood,

          address:
            details?.address?.trim() ||
            undefined,

          maps_link:
            details?.mapsLink?.trim() ||
            undefined,

          last_confirmation_code:
            details?.confirmationCode?.trim() ||
            undefined,

          observation:
            details?.observation?.trim() ||
            undefined,

          phone:
            details?.phone?.trim() ||
            undefined,

          createdAt: now,
          updated_at: now,
        };

        set((state) => ({
          customers: [
            newCustomer,
            ...state.customers,
          ],
        }));

        try {
          await setDoc(
            doc(
              db,
              'customers',
              newCustomer.id,
            ),
            sanitizeForFirebase(newCustomer),
          );

          return newCustomer.id;
        } catch (error) {
          set((state) => ({
            customers: state.customers.filter(
              (customer) =>
                customer.id !== newCustomer.id,
            ),
          }));

          console.error(
            'Erro ao criar cliente:',
            error,
          );

          throw error;
        }
      },"""

s = s[:start] + new_customer + s[end + len("\n      },"):]

p.write_text(s)

print("store/useAppStore.ts: OK")
PY

echo
echo "== 5/8 NOVA ENTREGA — IDENTIDADE EXPLÍCITA =="

python <<'PY'
from pathlib import Path

p = Path("app/entregas/nova/page.tsx")
s = p.read_text()

def once(old, new, label):
    global s

    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: esperado 1 trecho, encontrado {s.count(old)}"
        )

    s = s.replace(old, new, 1)

once(
"""  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');""",
"""  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [phone, setPhone] = useState('');""",
"state selectedCustomerId",
)

once(
"""    if (parsed.customerName) { setCustomerName(parsed.customerName); identified.push('Cliente'); }""",
"""    if (parsed.customerName) {
      setCustomerName(parsed.customerName);
      setSelectedCustomerId('');
      identified.push('Cliente');
    }""",
"parser limpa seleção",
)

once(
"""  const handleCustomerSelect = (c: Customer) => {
    setCustomerName(c.name);""",
"""  const handleCustomerSelect = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);""",
"seleção explícita",
)

once(
"""          observation,
          origin,
        });""",
"""          observation,
          origin,
          preferredCustomerId: selectedCustomerId || undefined,
        });""",
"preferredCustomerId",
)

once(
"""          <CustomerAutocomplete value={customerName} onChange={setCustomerName} onSelect={handleCustomerSelect} customers={customers} />""",
"""          <CustomerAutocomplete
            value={customerName}
            onChange={(nextName) => {
              setCustomerName(nextName);
              setSelectedCustomerId('');
            }}
            onSelect={handleCustomerSelect}
            customers={customers}
          />""",
"autocomplete",
)

p.write_text(s)

print("app/entregas/nova/page.tsx: OK")
PY

echo
echo "== 6/8 IFOOD — CENTRAL + SEQUÊNCIA PÓS-ROTA =="

python <<'PY'
from pathlib import Path

p = Path("app/confirmacoes/page.tsx")
s = p.read_text()

def once(old, new, label):
    global s

    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: esperado 1 trecho, encontrado {s.count(old)}"
        )

    s = s.replace(old, new, 1)

once(
"""  const confirmationReturn = `/confirmacoes?date=${encodeURIComponent(selectedDateKey)}`;
  const deliveryDateSuffix = `&date=${encodeURIComponent(selectedDateKey)}`;""",
"""  const confirmationReturn = useMemo(() => {
    const params = new URLSearchParams({
      date: selectedDateKey,
    });

    if (requestedRouteId) {
      params.set('route', requestedRouteId);
    }

    if (requestedRouteName) {
      params.set('routeName', requestedRouteName);
    }

    return `/confirmacoes?${params.toString()}`;
  }, [
    requestedRouteId,
    requestedRouteName,
    selectedDateKey,
  ]);

  const deliveryDateSuffix = `&date=${encodeURIComponent(selectedDateKey)}`;""",
"returnTo preserva rota",
)

# Corrige interpolação textual caso esteja realmente presente na base.
s = s.replace(
"""                ${requestedRouteName || 'Rota finalizada'}""",
"""                {requestedRouteName || 'Rota finalizada'}""",
)

s = s.replace(
"""                ${pendingManualConfirmations.length} pedido${pendingManualConfirmations.length === 1 ? '' : 's'} aguardando confirmação no iFood""",
"""                {pendingManualConfirmations.length} pedido{pendingManualConfirmations.length === 1 ? '' : 's'} aguardando confirmação no iFood""",
)

p.write_text(s)

print("app/confirmacoes/page.tsx: OK")
PY

python <<'PY'
from pathlib import Path

p = Path("app/confirmar/page.tsx")
s = p.read_text()

def once(old, new, label):
    global s

    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: esperado 1 trecho, encontrado {s.count(old)}"
        )

    s = s.replace(old, new, 1)

once(
"""  const updatePendingConfirmation = useAppStore(
    (state) => state.updateIfoodPendingConfirmation,
  );


  const [orderId, setOrderId] = useState(initialOrderId);""",
"""  const updatePendingConfirmation = useAppStore(
    (state) => state.updateIfoodPendingConfirmation,
  );

  const pendingConfirmations = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );

  const [orderId, setOrderId] = useState(initialOrderId);""",
"selector fila",
)

old = """  const confirmExternalAndLeave = async () => {
    if (!pendingId) {
      await leaveConfirmation();
      return;
    }

    try {
      await vibrate(ImpactStyle.Medium);

      await updatePendingConfirmation(pendingId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      });

      toast.success('Pedido marcado como confirmado no iFood.');
      router.replace(returnTo);
    } catch {
      toast.error('Não foi possível concluir a pendência.');
    }
  };"""

new = """  const confirmExternalAndLeave = async () => {
    if (!pendingId) {
      await leaveConfirmation();
      return;
    }

    try {
      await vibrate(ImpactStyle.Medium);

      const currentPending = pendingConfirmations.find(
        (item) => item.id === pendingId,
      );

      await updatePendingConfirmation(pendingId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      });

      const latest =
        useAppStore.getState().ifoodPendingConfirmations;

      const nextReady =
        currentPending?.route_id
          ? latest.find((item) => {
              if (item.id === pendingId) return false;

              if (
                (item.status || 'pending') !== 'pending'
              ) {
                return false;
              }

              if (
                item.route_id !== currentPending.route_id
              ) {
                return false;
              }

              const nextId = (
                item.ifood_id || ''
              )
                .replace(/\\D/g, '')
                .slice(0, 8);

              const nextCode = (
                item.confirmation_code || ''
              )
                .replace(/\\D/g, '')
                .slice(0, 4);

              return (
                nextId.length === 8 &&
                nextCode.length === 4
              );
            })
          : undefined;

      if (nextReady) {
        const nextId = (
          nextReady.ifood_id || ''
        )
          .replace(/\\D/g, '')
          .slice(0, 8);

        const nextCode = (
          nextReady.confirmation_code || ''
        )
          .replace(/\\D/g, '')
          .slice(0, 4);

        toast.success(
          'Confirmado. Próximo pedido carregado.',
        );

        router.replace(
          `/confirmar?orderId=${encodeURIComponent(
            nextId,
          )}&code=${encodeURIComponent(
            nextCode,
          )}&pendingId=${encodeURIComponent(
            nextReady.id,
          )}&returnTo=${encodeURIComponent(returnTo)}`,
        );

        return;
      }

      toast.success(
        'Pedido marcado como confirmado no iFood.',
      );

      router.replace(returnTo);
    } catch {
      toast.error(
        'Não foi possível concluir a pendência.',
      );
    }
  };"""

once(
    old,
    new,
    "sequência de confirmação",
)

p.write_text(s)

print("app/confirmar/page.tsx: OK")
PY

python <<'PY'
from pathlib import Path

p = Path("components/home/RouteAccordion.tsx")
s = p.read_text()

old = """  const handleCloseRoute = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await closeRoute(route.id);
      if (Capacitor.isNativePlatform()) await Haptics.notification({ type: NotificationType.Success });
      toast.success('Rota finalizada!', { description: 'Enviada para as rotas concluídas.' });
      setIsOpen(false);

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível finalizar a rota.');
    } finally { setActionBusy(false); }
  };"""

new = """  const handleCloseRoute = async () => {
    if (actionBusy) return;

    setActionBusy(true);

    try {
      await closeRoute(route.id);

      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({
          type: NotificationType.Success,
        });
      }

      const pendingIfood =
        useAppStore
          .getState()
          .ifoodPendingConfirmations
          .filter(
            (item) =>
              item.route_id === route.id &&
              (item.status || 'pending') === 'pending',
          );

      if (pendingIfood.length > 0) {
        const params = new URLSearchParams();

        if (operationalRouteDateKey) {
          params.set(
            'date',
            operationalRouteDateKey,
          );
        }

        params.set('route', route.id);
        params.set(
          'routeName',
          route.name || 'Rota finalizada',
        );

        const href =
          `/confirmacoes?${params.toString()}`;

        toast.success('Rota finalizada!', {
          description:
            `${pendingIfood.length} pedido${
              pendingIfood.length === 1 ? '' : 's'
            } aguardando confirmação no iFood.`,
          action: {
            label: 'Confirmar iFood',
            onClick: () => router.push(href),
          },
        });
      } else {
        toast.success('Rota finalizada!', {
          description:
            'Enviada para as rotas concluídas.',
        });
      }

      setIsOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível finalizar a rota.',
      );
    } finally {
      setActionBusy(false);
    }
  };"""

if s.count(old) != 1:
    raise SystemExit(
        "ABORTADO: handleCloseRoute esperado não encontrado."
    )

s = s.replace(old, new, 1)
p.write_text(s)

print("RouteAccordion.tsx: OK")
PY

echo
echo "== 7/8 CONTRATOS =="

grep -q "customerIdentityEvidence" lib/customer-identity.ts
grep -q "storedMissingIncomingIdentity" lib/customer-identity.ts
grep -q "preferredCustomerId" store/useAppStore.ts
grep -q "preferredCustomerId: selectedCustomerId" app/entregas/nova/page.tsx
grep -q "samePendingIdentity" store/useAppStore.ts
grep -q "source_kind:" store/useAppStore.ts
grep -q "nextReady" app/confirmar/page.tsx
grep -q "Confirmar iFood" components/home/RouteAccordion.tsx
grep -q "requestedRouteId" app/confirmacoes/page.tsx
grep -q "Nenhum duplicado provável" app/clientes/duplicados/page.tsx

# Contratos antigos que PRECISAM continuar existindo.
grep -q "Conclua todas as entregas antes de finalizar a rota" store/useAppStore.ts
grep -q "Inicie a rota antes de finalizá-la" store/useAppStore.ts
grep -q "Desfaça a baixa antes de mover uma entrega concluída" store/useAppStore.ts
grep -q "status: 'resolved'" app/confirmar/page.tsx

echo "Contratos estruturais: OK"

echo
echo "== 8/8 VALIDAÇÃO =="

git diff --check
node node_modules/typescript/bin/tsc --noEmit

echo
echo "============================================================"
echo " CIRURGIA 4 — CLIENTES + IFOOD: OK"
echo "============================================================"
echo "OK identidade de cliente consolidada"
echo "OK cadastro antigo incompleto é reutilizável"
echo "OK conflitos de telefone/endereço protegidos"
echo "OK seleção explícita preserva customer_id"
echo "OK autocomplete normalizado"
echo "OK revisão de duplicados usa identidade canônica"
echo "OK fila iFood virou upsert idempotente"
echo "OK registro resolvido não é ressuscitado"
echo "OK pendência manual pode ganhar vínculo de rota"
echo "OK Central preserva contexto pós-rota"
echo "OK confirmação sequencial na mesma rota"
echo "OK fechamento oferece ação Confirmar iFood"
echo "OK integridade de rotas preservada"
echo "OK git diff --check"
echo "OK TypeScript"
echo
git diff --stat
echo
git status --short
echo
echo "NÃO faça commit ainda."
echo "Me envie TODO o retorno desta cirurgia."
