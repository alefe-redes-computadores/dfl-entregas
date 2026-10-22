export const STOCK_PURCHASE_DRAFT_KEY = 'dfl-stock-purchase-draft-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export type StockPurchaseDraft = {
  version: 1;
  updatedAt: string;
  selected: Record<string, boolean>;
  quantities: Record<string, string>;
  presentationIds: Record<string, string>;
};

export function parseStockPurchaseDraft(
  raw: string | null,
  now = Date.now(),
): StockPurchaseDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StockPurchaseDraft>;
    const updatedAt = Date.parse(String(value.updatedAt || ''));
    if (
      value.version !== 1 ||
      !Number.isFinite(updatedAt) ||
      now - updatedAt > MAX_AGE_MS ||
      !value.selected || typeof value.selected !== 'object' ||
      !value.quantities || typeof value.quantities !== 'object' ||
      !value.presentationIds || typeof value.presentationIds !== 'object'
    ) return null;

    return value as StockPurchaseDraft;
  } catch {
    return null;
  }
}

export function compactStockPurchaseDraft(
  draft: StockPurchaseDraft,
  validProductIds: Set<string>,
): StockPurchaseDraft {
  const selected: Record<string, boolean> = {};
  const quantities: Record<string, string> = {};
  const presentationIds: Record<string, string> = {};

  for (const id of validProductIds) {
    if (draft.selected[id]) selected[id] = true;
    if (typeof draft.quantities[id] === 'string') quantities[id] = draft.quantities[id];
    if (typeof draft.presentationIds[id] === 'string') presentationIds[id] = draft.presentationIds[id];
  }

  return { ...draft, selected, quantities, presentationIds };
}
