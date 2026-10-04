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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    window.dispatchEvent(new CustomEvent(SITE_UNREAD_EVENT, { detail: safe.length }));
  } catch {
    // O badge nunca pode interromper a sincronizacao.
  }
}

export function markUnreadSiteOrders(ids: string[]) {
  write([...ids, ...readUnreadSiteOrderIds()]);
}

export function acknowledgeSiteOrders(ids?: string[]) {
  if (!ids?.length) return write([]);
  const seen = new Set(ids);
  write(readUnreadSiteOrderIds().filter((id) => !seen.has(id)));
}
