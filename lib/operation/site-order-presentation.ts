import type { Delivery } from '@/types';

/** Human-readable label only: never invent a commercial order number from an internal UUID. */
export function siteOrderDisplayReference(item: Pick<Delivery, 'order_id' | 'external_order_id' | 'id'>): string {
  const publicId = String(item.order_id || '').trim();
  if (/^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/.test(publicId) && !/^(?:site|dfl|delivery|pedido)[-_]/i.test(publicId)) {
    return `Pedido #${publicId}`;
  }
  return 'Pedido do Site';
}

/** Owner-only UI: no full recipient telephone appears in the diagnostics picker. */
export function maskedMessagePhone(value?: string | null): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return 'Telefone não informado';
  return `•••• ${digits.slice(-4)}`;
}

export function shortTechnicalReference(value?: string | null): string {
  const trimmed = String(value || '').trim();
  return trimmed ? `•••${trimmed.slice(-5).toUpperCase()}` : 'sem referência';
}
