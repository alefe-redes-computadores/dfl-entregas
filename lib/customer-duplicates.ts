// lib/customer-duplicates.ts
import type { Customer, Delivery } from '@/types';
import { customerPhones, customerAddresses } from '@/lib/customer-contact-book';

import {
  normalizeCustomerName,
  sameCustomerAddress,
} from '@/lib/customer-identity';

const phoneDigits = (value?: string) => { const digits=(value || '').replace(/\D/g, ''); return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits; };
const validPhones = (customer: Customer) => new Set(customerPhones(customer).map(p=>phoneDigits(p.number)).filter(p=>p.length>=10));

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

  // Apenas nome-base igual E telefone confirmado em comum justificam a sugestao.
  // Endereco diferente e um destino adicional, nao evidencia de outra pessoa.
  // Os indexes evitam comparar todos os clientes entre si.
  const names = customers.map(customer => normalizeCustomerName(customer.name));
  const phones = customers.map(validPhones);
  const byPhone = new Map<string, number[]>();
  customers.forEach((_, index) => {
    if (!names[index]) return;
    for (const phone of phones[index]) {
      const bucket = byPhone.get(phone) || [];
      bucket.push(index);
      byPhone.set(phone, bucket);
    }
  });
  const visited = new Set<string>();
  for (let i = 0; i < customers.length; i += 1) {
    const indexes = new Set<number>();
    for (const phone of phones[i]) for (const index of byPhone.get(phone) || []) indexes.add(index);
    for (const j of [...indexes].filter(index => index > i).sort((a,b)=>a-b)) {
      const key = `${i}:${j}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!names[i] || names[i] !== names[j]) continue;
      const left = customers[i], right = customers[j];
      const matchingPhones = [...phones[i]].filter(phone => phones[j].has(phone));
      if (!matchingPhones.length) continue;
      // Telefones validos conflitantes bloqueiam sugestao: usuario pediu
      // nao sugerir quando sao telefones diferentes.
      const distinctLeft = [...phones[i]].filter(phone => !phones[j].has(phone));
      const distinctRight = [...phones[j]].filter(phone => !phones[i].has(phone));
      if (distinctLeft.length && distinctRight.length) continue;
      const leftAddresses = customerAddresses(left);
      const rightAddresses = customerAddresses(right);
      const sameAddress = leftAddresses.some(a => rightAddresses.some(b => sameCustomerAddress(a.address,b.address)));
      const samePhone = matchingPhones.length > 0;
      result.push({left,right,score:samePhone && sameAddress ? 99 : 97,
        reasons:[
          'Mesmo nome-base',
          'Mesmo telefone confirmado',
          sameAddress?'Endereco compartilhado':'Enderecos diferentes: preservar ambos',
        ],
        leftOrders:orderCounts.get(left.id)||0,rightOrders:orderCounts.get(right.id)||0});
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
