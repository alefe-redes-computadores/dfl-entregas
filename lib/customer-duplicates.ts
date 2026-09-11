// lib/customer-duplicates.ts
import type { Customer, Delivery } from '@/types';

const plain = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(\d+\)\s*$/g, '')
    .replace(/\b(rua|r\.?)\b/g, ' ')
    .replace(/\b(avenida|av\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const digits = (value?: string) => (value || '').replace(/\D/g, '');

const addressKey = (value?: string) =>
  plain(value)
    .replace(/\bpatos de minas\b/g, ' ')
    .replace(/\bminas gerais\b|\bmg\b|\bbrasil\b/g, ' ')
    .replace(/\b\d{5}\s?\d{3}\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export interface CustomerDuplicateCandidate {
  left: Customer;
  right: Customer;
  score: number;
  reasons: string[];
  leftOrders: number;
  rightOrders: number;
}

export function customerBaseName(customer: Pick<Customer, 'name'>) {
  return plain(customer.name);
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
      const leftName = customerBaseName(left);
      const rightName = customerBaseName(right);

      if (!leftName || leftName !== rightName) continue;

      const reasons = ['Mesmo nome-base'];
      let score = 45;

      const leftPhone = digits(left.phone);
      const rightPhone = digits(right.phone);
      if (leftPhone && rightPhone && leftPhone === rightPhone) {
        score += 35;
        reasons.push('Mesmo telefone');
      }

      const leftAddress = addressKey(left.address);
      const rightAddress = addressKey(right.address);
      if (leftAddress && rightAddress && leftAddress === rightAddress) {
        score += 35;
        reasons.push('Mesmo endereço');
      }

      const leftNeighborhood = plain(left.neighborhood);
      const rightNeighborhood = plain(right.neighborhood);
      if (
        leftNeighborhood &&
        rightNeighborhood &&
        leftNeighborhood === rightNeighborhood
      ) {
        score += 10;
        reasons.push('Mesmo bairro');
      }

      // Nome igual sozinho é suspeita, não autorização automática de merge.
      result.push({
        left,
        right,
        score: Math.min(score, 100),
        reasons,
        leftOrders: orderCounts.get(left.id) || 0,
        rightOrders: orderCounts.get(right.id) || 0,
      });
    }
  }

  return result.sort(
    (a, b) =>
      b.score - a.score ||
      b.leftOrders + b.rightOrders - (a.leftOrders + a.rightOrders),
  );
}
