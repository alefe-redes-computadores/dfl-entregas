// lib/customer-analytics.ts
import type { Customer, Delivery } from '@/types';
import { deliveryCustomerCharge } from '@/lib/delivery-finance';
import { deliveryDate } from '@/lib/operational-time';
import { verifiedInternalCustomer } from '@/lib/internal-owner-identity';
import { customerPhones, customerAddresses } from '@/lib/customer-contact-book';

export interface CustomerStats {
  deliveries: Delivery[];
  orderCount: number;
  completedCount: number;
  pendingCount: number;
  totalValue: number;
  averageTicket: number;
  lastOrderAt?: string;
}

export const normalizeCustomerName = (value?: string) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

/** Unified, conservative owner rule: never infer from a matching first name. */
export function isOperationalCustomer(customer: Customer): boolean {
  return verifiedInternalCustomer(customer);
}

export const getDeliveryCreatedAt = (delivery: Delivery) => deliveryDate(delivery) || undefined;

export function deliveryBelongsToCustomer(delivery: Delivery, customer: Customer): boolean {
  if (delivery.customer_id) return delivery.customer_id === customer.id;
  // Legacy rows without an ID require concordant name, phone and address.
  const matchingName = normalizeCustomerName(delivery.customer_name) === normalizeCustomerName(customer.name);
  if (!matchingName || !delivery.phone || !delivery.address_string) return false;
  const phone = String(delivery.phone).replace(/\D/g, '');
  const address = String(delivery.address_string).toLocaleLowerCase('pt-BR').trim();
  return customerPhones(customer).some(item=>item.number.replace(/\D/g,'')===phone) &&
    customerAddresses(customer).some(item=>item.address.toLocaleLowerCase('pt-BR').trim()===address);
}

export function getCustomerStats(customer: Customer, deliveries: Delivery[]): CustomerStats {
  const linked = deliveries
    .filter(delivery =>
      deliveryBelongsToCustomer(delivery, customer) &&
      delivery.exclude_customer_metrics !== true &&
      delivery.developer_test !== true
    )
    .sort((a,b) => new Date(getDeliveryCreatedAt(b) || 0).getTime() - new Date(getDeliveryCreatedAt(a) || 0).getTime());
  const totalValue = linked.reduce((total, delivery) => total + deliveryCustomerCharge(delivery), 0);
  const completedCount = linked.filter(delivery => delivery.completed).length;
  return {
    deliveries: linked,
    orderCount: linked.length,
    completedCount,
    pendingCount: linked.length - completedCount,
    totalValue,
    averageTicket: linked.length ? totalValue / linked.length : 0,
    lastOrderAt: linked[0] ? getDeliveryCreatedAt(linked[0]) : undefined,
  };
}


/**
 * Projeção local para a tela Clientes: uma passagem pelos pedidos e uma
 * ordenação por cliente, sem N buscas completas no histórico a cada render.
 * Reproduz exatamente a regra legacy: customer_id tem prioridade; apenas
 * pedidos SEM ID usam o nome normalizado (inclusive nomes homônimos).
 * Não grava nada e não consulta Firestore.
 */
export function buildCustomerStatsIndex(customers: Customer[], deliveries: Delivery[]): Map<string, CustomerStats> {
  const byName = new Map<string, string[]>();
  const customerById = new Map(customers.map(item=>[item.id,item]));
  const linked = new Map<string, Delivery[]>();
  const knownIds = new Set(customers.map(customer => customer.id));

  for (const customer of customers) {
    linked.set(customer.id, []);
    const key = normalizeCustomerName(customer.name);
    if (!key) continue;
    const bucket = byName.get(key) || [];
    bucket.push(customer.id);
    byName.set(key, bucket);
  }

  for (const delivery of deliveries) {
    if (delivery.exclude_customer_metrics === true || delivery.developer_test === true) continue;
    if (delivery.customer_id) {
      if (knownIds.has(delivery.customer_id)) linked.get(delivery.customer_id)?.push(delivery);
      continue;
    }
    const name = normalizeCustomerName(delivery.customer_name);
    if (!name) continue;
    const candidateIds=byName.get(name)||[];
    if (candidateIds.length !== 1) continue; // Homonyms remain unassigned.
    const candidate=customerById.get(candidateIds[0]);
    if (!candidate) continue;
    const phone=String(delivery.phone||'').replace(/\D/g,'');
    const address=String(delivery.address_string||'').toLocaleLowerCase('pt-BR').trim();
    const verifiedPhone=phone.length>=10&&customerPhones(candidate).some(item=>item.number.replace(/\D/g,'')===phone);
    const verifiedAddress=address.length>=10&&customerAddresses(candidate).some(item=>item.address.toLocaleLowerCase('pt-BR').trim()===address);
    if (verifiedPhone && verifiedAddress) linked.get(candidate.id)?.push(delivery);
  }

  const stats = new Map<string, CustomerStats>();
  for (const customer of customers) {
    const orders = linked.get(customer.id) || [];
    orders.sort((a, b) => new Date(getDeliveryCreatedAt(b) || 0).getTime() - new Date(getDeliveryCreatedAt(a) || 0).getTime());
    let completedCount = 0;
    let totalValue = 0;
    for (const order of orders) {
      if (order.completed) completedCount += 1;
      totalValue += deliveryCustomerCharge(order);
    }
    stats.set(customer.id, {
      deliveries: orders,
      orderCount: orders.length,
      completedCount,
      pendingCount: orders.length - completedCount,
      totalValue,
      averageTicket: orders.length ? totalValue / orders.length : 0,
      lastOrderAt: orders[0] ? getDeliveryCreatedAt(orders[0]) : undefined,
    });
  }
  return stats;
}
