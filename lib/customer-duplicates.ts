// lib/customer-duplicates.ts
import type { Customer, Delivery } from '@/types';

import {
  customerNameSimilarity,
  normalizeCustomerName,
  sameCustomerAddress,
} from '@/lib/customer-identity';

const phoneDigits = (value?: string) => (value || '').replace(/\D/g, '');

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

  // Indexar candidatos evita comparar clientes sem nome/telefone em comum.
  // A régua de identidade abaixo e a ordem dos resultados continuam iguais.
  const names = customers.map(customer => normalizeCustomerName(customer.name));
  const phones = customers.map(customer => phoneDigits(customer.phone));
  const byName = new Map<string, number[]>();
  const byPhone = new Map<string, number[]>();
  customers.forEach((_, index) => {
    if (!names[index]) return;
    const nameBucket = byName.get(names[index]) || [];
    nameBucket.push(index);
    byName.set(names[index], nameBucket);
    if (phones[index].length >= 10) {
      const phoneBucket = byPhone.get(phones[index]) || [];
      phoneBucket.push(index);
      byPhone.set(phones[index], phoneBucket);
    }
  });

  for (let i = 0; i < customers.length; i += 1) {
    const candidates = new Set([
      ...(byName.get(names[i]) || []),
      ...(byPhone.get(phones[i]) || []),
    ]);
    for (const j of Array.from(candidates).filter(index => index > i).sort((a, b) => a - b)) {
      const left = customers[i];
      const right = customers[j];

      const leftName = names[i];
      const rightName = names[j];

      if (!leftName || !rightName) continue;

      /*
       * Nome-base precisa representar a mesma identidade textual.
       * Isso já trata "Maria" e "Maria (2)" como o mesmo nome-base.
       */
      const sameBaseName = leftName === rightName;
      const leftPhone = phones[i];
      const rightPhone = phones[j];
      const samePhone = leftPhone.length >= 10 && leftPhone === rightPhone;

      if (!sameBaseName && !samePhone) continue;

      /*
       * Na tela de possíveis duplicados exigimos endereço dos dois
       * lados e correspondência canônica do endereço.
       *
       * Mesmo nome em endereços diferentes NÃO entra na lista.
       */
      const sameAddress = Boolean(
        left.address?.trim() && right.address?.trim() &&
        sameCustomerAddress(left.address, right.address),
      );

      if (!sameAddress && !samePhone) continue;

      const similarity = customerNameSimilarity(
        left.name,
        right.name,
      );

      if (!sameBaseName && similarity < 0.72) continue;

      const reasons = [
        sameBaseName ? 'Mesmo nome-base' : '',
        samePhone ? 'Mesmo telefone' : '',
        sameAddress ? 'Mesmo endereço' : '',
      ].filter(Boolean);

      /*
       * 95 significa "candidato muito forte", mas a tela continua
       * exigindo confirmação humana. Nenhum merge é automático.
       */
      result.push({
        left,
        right,
        score: samePhone && sameAddress ? 99 : samePhone ? 97 : 95,
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
