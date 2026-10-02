import type { Delivery } from '@/types';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';

export type DeliveryChannel = 'ifood' | 'site' | 'store';
export function deliveryChannel(delivery: Pick<Delivery, 'origin' | 'source_system'>): DeliveryChannel {
  if (delivery.source_system === 'dfl_site') return 'site';
  if (delivery.origin === 'ifood' || !delivery.origin) return 'ifood';
  return 'store';
}
export function deliveryOrderNumber(delivery: Pick<Delivery, 'external_order_id' | 'order_id'>) { return delivery.external_order_id?.trim() || delivery.order_id?.trim() || ''; }
export function deliveryChannelLabel(delivery: Pick<Delivery, 'origin' | 'source_system'>) { const channel = deliveryChannel(delivery); return channel === 'site' ? 'Pedido do Site' : channel === 'ifood' ? 'Pedido iFood' : 'Pedido da loja'; }
export function formatBrazilianPhone(value?: string) { let digits = String(value || '').replace(/\D/g, ''); if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2); if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`; if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`; return value?.trim() || ''; }
export function operationalMapsUrl(delivery: Pick<Delivery, 'maps_link' | 'address_string'>) { if (delivery.maps_link?.trim()) return delivery.maps_link.trim(); const clean = canonicalizeOperationalAddress(delivery.address_string).address || delivery.address_string; const query = /patos de minas/i.test(clean) ? clean : `${clean}, Patos de Minas - MG`; return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`; }
export function siteStatusLabel(value?: string) { const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); if (!normalized) return 'Recebido'; if (normalized.includes('cancel')) return 'Cancelado'; if (normalized.includes('final') || normalized.includes('conclu')) return 'Finalizado no Site'; if (normalized.includes('entrega') || normalized.includes('saiu')) return 'Saiu para entrega'; if (normalized.includes('pronto')) return 'Pedido pronto'; if (normalized.includes('prepar')) return 'Em preparo'; if (normalized.includes('aceit') || normalized.includes('confirm')) return 'Aceito pela loja'; if (normalized.includes('pend')) return 'Aguardando confirmação'; return value!.trim(); }
