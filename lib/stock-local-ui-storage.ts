/**
 * Persistência visual é opcional: bloqueios de armazenamento, quota e modo
 * privado não podem interromper a operação física no estoque.
 * Jamais utilizar para autoridade de saldo, compras ou movimentações.
 */
export type StockUiStorageKind = 'local' | 'session';

function getStorage(kind: StockUiStorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStockUiStorage(kind: StockUiStorageKind, key: string): string | null {
  try { return getStorage(kind)?.getItem(key) ?? null; } catch { return null; }
}

export function writeStockUiStorage(kind: StockUiStorageKind, key: string, value: string): boolean {
  try {
    const storage = getStorage(kind);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch { return false; }
}

export function removeStockUiStorage(kind: StockUiStorageKind, key: string): void {
  try { getStorage(kind)?.removeItem(key); } catch { /* best effort */ }
}
