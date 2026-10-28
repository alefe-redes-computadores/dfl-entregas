import type { Delivery } from '@/types';

export type HomeActionCandidate = Pick<
  Delivery,
  'id' | 'customer_name' | 'order_id' | 'address_string' | 'route_id'
>;

export type HomeActionEntry = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export function homeActionQueue(
  candidates: readonly HomeActionCandidate[],
  requestedLimit = 16,
): { entries: HomeActionEntry[]; total: number; omitted: number } {
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(25, Math.floor(requestedLimit)))
    : 16;
  const seen = new Set<string>();
  const entries: HomeActionEntry[] = [];
  let total = 0;

  for (const delivery of candidates) {
    const id = String(delivery.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    total += 1;
    if (entries.length >= limit) continue;

    const customer = String(delivery.customer_name || '').trim() || 'Cliente sem nome';
    const order = String(delivery.order_id || '').trim();
    const address = String(delivery.address_string || '').trim();
    entries.push({
      id,
      title: order ? `${customer} · #${order}` : customer,
      subtitle: address || 'Endereço não informado',
      href: `/entregas/editar?id=${encodeURIComponent(id)}`,
    });
  }
  return { entries, total, omitted: Math.max(0, total - entries.length) };
}
