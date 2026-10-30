/** DFL_R201_ATOMIC_IMPORT — Identidade comercial estável, sem coleção nova. */
import type { Delivery } from '@/types';

/** Apenas entradas manuais com identificador forte participam da trava remota. */
export function deliveryImportDocumentId(
  item: Pick<Delivery, 'origin' | 'source_system' | 'ifood_id' | 'order_id' | 'created_at' | 'createdAt'>,
): string | null {
  if (item.source_system === 'dfl_site') return null;
  if (item.origin !== 'ifood' && item.origin !== 'food99') return null;
  const ifoodId = String(item.ifood_id || '').replace(/\D/g, '');
  if (item.origin === 'ifood' && /^[0-9]{6,32}$/.test(ifoodId)) {
    return `dfl-import-v1-ifood-id-${ifoodId}`;
  }
  const order = String(item.order_id || '').trim().replace(/^#/, '');
  if (item.origin === 'food99' ? !/^\d{6}$/.test(order) : !/^[a-zA-Z0-9]{1,32}$/.test(order)) return null;
  const rawDate = item.created_at || item.createdAt;
  if (!rawDate) return null;
  const stamp = new Date(rawDate);
  if (!Number.isFinite(stamp.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(stamp);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `dfl-import-v1-${item.origin}-order-${order.toLowerCase()}-${day}`;
}

/** Não autoriza atualizar/reescrever um documento que já existe no Firestore. */
export function assertFreshRemoteImportIds(
  requestedIds: readonly string[], occupiedIds: readonly string[],
): void {
  const ids = requestedIds.map(value => String(value || '').trim());
  if (!ids.length || ids.some(value => !value || value.includes('/')) || new Set(ids).size !== ids.length) {
    throw new Error('Lote de importação com IDs repetidos ou inválidos. Confira os pedidos.');
  }
  if (occupiedIds.some(value => ids.includes(value))) {
    throw new Error('Pedido já registrado no Firestore por outro aparelho. Sincronize antes de continuar.');
  }
}
