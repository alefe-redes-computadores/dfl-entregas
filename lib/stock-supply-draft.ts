export const STOCK_SUPPLY_DRAFT_VERSION = 1;

export type StockSupplyDraft<T> = {
  version: typeof STOCK_SUPPLY_DRAFT_VERSION;
  savedAt: string;
  value: T;
};

export function stockSupplyDraftKey(supplyId?: string) {
  return `dfl-stock-supply-draft:${supplyId || 'new'}`;
}

export function readStockSupplyDraft<T>(key: string): StockSupplyDraft<T> | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null') as StockSupplyDraft<T> | null;
    if (!parsed || parsed.version !== STOCK_SUPPLY_DRAFT_VERSION || !parsed.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStockSupplyDraft<T>(key: string, value: T) {
  const draft: StockSupplyDraft<T> = {
    version: STOCK_SUPPLY_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    value,
  };
  localStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export function removeStockSupplyDraft(key: string) {
  localStorage.removeItem(key);
}
