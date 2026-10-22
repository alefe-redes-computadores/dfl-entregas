import type { Delivery } from '@/types';
import { deriveDeliveryPaymentState } from '@/lib/delivery-finance';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { siteInboxState } from '@/lib/operation/siteInboxPolicy';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';

/** Projeção exclusivamente local: não cria consultas ou listeners. */
export function operationalAttention(orders: readonly Delivery[]) {
  const tasks = operationalAttentionTasks(orders);
  const awaitingSite = tasks.filter(task => task.kind === 'site_confirmation').length;
  const awaitingDispatch = tasks.filter(task => task.kind === 'site_dispatch').length;
  const pendingPix = tasks.filter(task => task.kind === 'pix_pending').length;
  const collectOnDelivery = tasks.filter(task => task.kind === 'collect').length;
  return { awaitingSite, awaitingDispatch, pendingPix, collectOnDelivery, total: tasks.length };
}

export type AttentionKind = 'site_confirmation' | 'site_dispatch' | 'pix_pending' | 'collect';
export interface AttentionTask {
  key: string;
  deliveryId: string;
  kind: AttentionKind;
  customer: string;
  orderRef: string;
  address: string;
  amount: number;
}
/** A single order can expose more than one *different* pending action. */
export function operationalAttentionTasks(orders: readonly Delivery[]): AttentionTask[] {
  const tasks: AttentionTask[] = [];
  for (const delivery of orders) {
    if (isCancelledSiteDelivery(delivery) || delivery.completed || delivery.operational_dismissed_at) continue;
    const customer = (delivery.customer_name || 'Cliente não informado').trim();
    const orderRef = String(delivery.external_order_id || delivery.order_id || delivery.ifood_id || '').trim();
    const address = (delivery.address_string || '').trim();
    const rawAmount = Number(delivery.customer_charge ?? delivery.value ?? 0);
    const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : 0;
    const add = (kind: AttentionKind) => tasks.push({ key: `${delivery.id}:${kind}`, deliveryId: delivery.id, kind, customer, orderRef, address, amount });
    if (delivery.source_system === 'dfl_site') {
      const siteState = siteInboxState(delivery);
      if (siteState === 'confirmar') add('site_confirmation');
      else if (siteState === 'pronto') add('site_dispatch');
    }
    const payment = deriveDeliveryPaymentState(delivery);
    if (payment === 'pending' && delivery.payment_method === 'pix') add('pix_pending');
    else if (payment === 'collect_on_delivery') add('collect');
  }
  return tasks;
}
