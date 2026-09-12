// lib/customer-duplicates.ts
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
