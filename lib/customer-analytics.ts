// lib/customer-analytics.ts
import type { Customer, Delivery } from '@/types';
import { deliveryCustomerCharge } from '@/lib/delivery-finance';
import { deliveryDate } from '@/lib/operational-time';

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

const normalizeCustomerAddress = (value?: string) => normalizeCustomerName(value)
  .replace(/\b(?:rua|r\.?|avenida|av\.?)\b/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Cadastros reais que pertencem à operação, mas não devem disputar rankings de clientes. */
export function isOperationalCustomer(customer: Customer): boolean {
  const name = normalizeCustomerName(customer.name);
  const address = normalizeCustomerAddress(customer.address);
  return name === 'alefe' && address.includes('lazaro martins marciel 164') && address.includes('jardim quebec');
}

export const getDeliveryCreatedAt = (delivery: Delivery) => deliveryDate(delivery) || undefined;

export function deliveryBelongsToCustomer(delivery: Delivery, customer: Customer): boolean {
  if (delivery.customer_id) return delivery.customer_id === customer.id;
  const deliveryName = normalizeCustomerName(delivery.customer_name);
  return Boolean(deliveryName) && deliveryName === normalizeCustomerName(customer.name);
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
    for (const id of byName.get(name) || []) linked.get(id)?.push(delivery);
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
