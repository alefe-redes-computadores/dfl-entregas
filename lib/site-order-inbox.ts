const STORAGE_KEY = 'dfl-site-unread-orders-v1';
export const SITE_UNREAD_EVENT = 'dfl:site-unread-changed';

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 99);
}

export function readUnreadSiteOrderIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return cleanIds(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const safe = cleanIds(ids);
    const serialized = JSON.stringify(safe);
    if (localStorage.getItem(STORAGE_KEY) === serialized) return;
    localStorage.setItem(STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(SITE_UNREAD_EVENT, { detail: safe.length }));
  } catch {
    // O badge nunca pode interromper a sincronizacao.
  }
}

export function markUnreadSiteOrders(ids: string[]) {
  // Evita disparar atualização da UI quando a sincronização não trouxe pedido novo.
  const incoming = cleanIds(ids);
  if (!incoming.length) return;
  const current = readUnreadSiteOrderIds();
  const existing = new Set(current);
  if (incoming.every(id => existing.has(id))) return;
  write([...incoming, ...current]);
}

export function acknowledgeSiteOrders(ids?: string[]) {
  if (!ids?.length) return write([]);
  const seen = new Set(ids);
  write(readUnreadSiteOrderIds().filter((id) => !seen.has(id)));
}
