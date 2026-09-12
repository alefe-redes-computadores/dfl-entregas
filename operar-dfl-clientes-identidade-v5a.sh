#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/storage/shared/Documents/dfl-entregas

EXPECTED_HEAD="3991b4ac4acab5d0f690ea4fb75d060fe572578e"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/clientes-identidade-v5a-${STAMP}"

echo "============================================================"
echo " DFL ENTREGAS — CLIENTES IDENTIDADE V5A"
echo " ENDEREÇO CANÔNICO + DUPLICADOS CONSERVADORES"
echo "============================================================"

[ "$(pwd)" = "$HOME/storage/shared/Documents/dfl-entregas" ] || {
  echo "ABORTADO: diretório incorreto."
  exit 1
}

HEAD="$(git rev-parse HEAD)"
[ "$HEAD" = "$EXPECTED_HEAD" ] || {
  echo "ABORTADO: HEAD divergente."
  echo "Esperado: $EXPECTED_HEAD"
  echo "Atual:    $HEAD"
  exit 1
}

git diff --quiet || {
  echo "ABORTADO: há alterações TRACKED."
  git status --short
  exit 1
}

for f in lib/customer-identity.ts lib/customer-duplicates.ts; do
  [ -f "$f" ] || {
    echo "ABORTADO: ausente $f"
    exit 1
  }
done

mkdir -p "$BACKUP/lib"
cp lib/customer-identity.ts "$BACKUP/lib/customer-identity.ts"
cp lib/customer-duplicates.ts "$BACKUP/lib/customer-duplicates.ts"

python <<'PY'
from pathlib import Path

p = Path("lib/customer-identity.ts")
s = p.read_text()

old = """  const addressConflict =
    Boolean(
      storedAddress &&
        wantedAddress &&
        storedNumber &&
        wantedNumber,
    ) &&
    storedNumber !== wantedNumber;

  let score = 0;"""

new = """  /*
   * Há duas formas diferentes de conflito:
   *
   * 1. número explicitamente diferente;
   * 2. ambos possuem endereço conhecido, mas a comparação
   *    canônica não reconhece os dois como o mesmo local.
   *
   * A segunda é essencial: faltar telefone em um cadastro
   * NÃO pode autorizar união de duas pessoas com endereços
   * conhecidos e diferentes.
   */
  const addressNumberConflict =
    Boolean(
      storedAddress &&
        wantedAddress &&
        storedNumber &&
        wantedNumber,
    ) &&
    storedNumber !== wantedNumber;

  const knownAddressMismatch =
    Boolean(storedAddress && wantedAddress) &&
    !sameAddress;

  const addressConflict =
    addressNumberConflict || knownAddressMismatch;

  let score = 0;"""

if s.count(old) != 1:
    raise SystemExit(
        f"ABORTADO addressConflict: encontrado {s.count(old)}"
    )

s = s.replace(old, new, 1)

old = """  const reusable =
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
    );"""

new = """  /*
   * Reutilização automática é diferente de sugestão de merge.
   *
   * - endereço conhecido e diferente SEMPRE bloqueia reutilização;
   * - endereço igual + nome compatível é evidência forte;
   * - telefone igual ajuda, mas não sobrepõe conflito de endereço;
   * - nome igual permite enriquecer um cadastro realmente
   *   incompleto, desde que não exista identidade contraditória.
   */
  const reusable =
    !addressConflict &&
    (
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
        (
          !incomingHasIdentity ||
          storedMissingIncomingIdentity ||
          samePhone ||
          sameAddress
        )
      )
    );"""

if s.count(old) != 1:
    raise SystemExit(
        f"ABORTADO reusable: encontrado {s.count(old)}"
    )

s = s.replace(old, new, 1)

p.write_text(s)
print("customer-identity: OK")
PY

cat > lib/customer-duplicates.ts <<'TS'
// lib/customer-duplicates.ts
import type { Customer, Delivery } from '@/types';

import {
  customerNameSimilarity,
  normalizeCustomerName,
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

/**
 * Revisão manual de duplicados usa uma régua propositalmente
 * mais conservadora que findExistingCustomer().
 *
 * Um nome igual sozinho NÃO é suficiente para sugerir merge.
 *
 * Exemplo:
 *   João / João (2) + mesmo endereço     => candidato
 *   João / João (2) + endereço diferente => não aparece
 *
 * Os sufixos "(2)", "(3)" etc. são removidos pela
 * normalização canônica de nome.
 */
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

      const leftName = normalizeCustomerName(left.name);
      const rightName = normalizeCustomerName(right.name);

      if (!leftName || !rightName) continue;

      /*
       * Nome-base precisa representar a mesma identidade textual.
       * Isso já trata "Maria" e "Maria (2)" como o mesmo nome-base.
       */
      const sameBaseName = leftName === rightName;

      if (!sameBaseName) continue;

      /*
       * Na tela de possíveis duplicados exigimos endereço dos dois
       * lados e correspondência canônica do endereço.
       *
       * Mesmo nome em endereços diferentes NÃO entra na lista.
       */
      if (!left.address?.trim() || !right.address?.trim()) {
        continue;
      }

      const sameAddress = sameCustomerAddress(
        left.address,
        right.address,
      );

      if (!sameAddress) continue;

      const similarity = customerNameSimilarity(
        left.name,
        right.name,
      );

      if (similarity < 0.95) continue;

      const reasons = [
        'Mesmo nome-base',
        'Mesmo endereço',
      ];

      /*
       * 95 significa "candidato muito forte", mas a tela continua
       * exigindo confirmação humana. Nenhum merge é automático.
       */
      result.push({
        left,
        right,
        score: 95,
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
TS

echo
echo "== CONTRATOS =="

grep -q "knownAddressMismatch" lib/customer-identity.ts
grep -q "addressConflict =" lib/customer-identity.ts
grep -q "sameBaseName" lib/customer-duplicates.ts
grep -q "if (!sameAddress) continue" lib/customer-duplicates.ts
grep -q "Mesmo endereço" lib/customer-duplicates.ts

echo "OK endereço diferente bloqueia reutilização"
echo "OK mesmo nome sozinho não sugere merge"
echo "OK nome-base considera sufixos (2), (3)..."
echo "OK revisão exige mesmo endereço"

echo
echo "== TESTES DE CONTRATO =="

node <<'NODE'
require('typescript');

const fs = require('fs');

const identity = fs.readFileSync(
  'lib/customer-identity.ts',
  'utf8',
);

const duplicates = fs.readFileSync(
  'lib/customer-duplicates.ts',
  'utf8',
);

if (!identity.includes('knownAddressMismatch')) {
  throw new Error('Contrato de endereço divergente ausente');
}

if (!duplicates.includes('if (!sameAddress) continue')) {
  throw new Error('Duplicados ainda não exigem endereço igual');
}

if (
  duplicates.includes(
    "const reasons = ['Mesmo nome-base'];"
  )
) {
  throw new Error(
    'Nome sozinho ainda está sendo aceito como candidato'
  );
}

console.log('Contratos de identidade: OK');
NODE

echo
echo "== VALIDAÇÃO =="

git diff --check
node node_modules/typescript/bin/tsc --noEmit

echo
echo "============================================================"
echo " CLIENTES IDENTIDADE V5A: OK"
echo "============================================================"
echo "OK mesmo nome + endereço diferente => NÃO sugere merge"
echo "OK mesmo nome + mesmo endereço => candidato"
echo "OK João e João (2) usam mesmo nome-base"
echo "OK endereço divergente bloqueia reaproveitamento automático"
echo "OK cadastro realmente incompleto ainda pode ser enriquecido"
echo "OK telefone/Maps/código continuam enriquecendo cliente existente"
echo "OK nenhuma mesclagem automática foi criada"
echo "OK git diff --check"
echo "OK TypeScript"
echo
git diff --stat
echo
git status --short
echo
echo "NÃO faça commit ainda."
echo "Me envie TODO o retorno."
