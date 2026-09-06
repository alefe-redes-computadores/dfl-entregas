// lib/customer-analytics.ts
import type { Customer, Delivery } from '@/types';

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

export const getDeliveryCreatedAt = (delivery: Delivery) => delivery.created_at || delivery.createdAt || delivery.updated_at;

export function deliveryBelongsToCustomer(delivery: Delivery, customer: Customer): boolean {
  if (delivery.customer_id) return delivery.customer_id === customer.id;
  const deliveryName = normalizeCustomerName(delivery.customer_name);
  return Boolean(deliveryName) && deliveryName === normalizeCustomerName(customer.name);
}

export function getCustomerStats(customer: Customer, deliveries: Delivery[]): CustomerStats {
  const linked = deliveries
    .filter(delivery => deliveryBelongsToCustomer(delivery, customer))
    .sort((a,b) => new Date(getDeliveryCreatedAt(b) || 0).getTime() - new Date(getDeliveryCreatedAt(a) || 0).getTime());
  const totalValue = linked.reduce((total, delivery) => total + (delivery.value || 0), 0);
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
