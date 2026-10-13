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
      const leftPhone = phoneDigits(left.phone);
      const rightPhone = phoneDigits(right.phone);
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
