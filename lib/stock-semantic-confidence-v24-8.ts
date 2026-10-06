export type StockSemanticConfidence = "trusted" | "historical_ambiguity";

const AMBIGUOUS_IDS = new Set([
  "stock-1789058835068",          // Filé: histórico antigo fracionado em base un
  "stock-1789059135270",          // Gás legado: consumo fracionado
  "stock-1789059270912",          // Milho: histórico misto/fracionado
  "stock-1789064245029-bi56y",    // Pimenta: base un com consumo 0.7/0.3
  "stock-1789166741727-79tek",    // Ovos: base pct com 0.5 histórico
  "stock-1789748161060-hen8v",    // Hamburgueira legado: pct, sem prova de escala
  "stock-1789785312950-2olr5",    // Papel Acoplado 400: pct fracionado
  "stock-1789785345739-vl1fu",    // Lacre 500: pct, evidência insuficiente
  "catalog-luva",                 // Luva: pct×100, sem prova para reescrever base
]);

export function stockSemanticConfidence(productId?: string | null): StockSemanticConfidence {
  return productId && AMBIGUOUS_IDS.has(productId) ? "historical_ambiguity" : "trusted";
}

export function shouldSuppressStockConsumptionIntelligence(productId?: string | null): boolean {
  return stockSemanticConfidence(productId) === "historical_ambiguity";
}

export const STOCK_SEMANTIC_REVIEW_IDS = Object.freeze([...AMBIGUOUS_IDS]);

export type StockConsumptionDisplayState =
  | { kind: "available" }
  | {
      kind: "semantic_review";
      title: "Consumo aguardando revisão da unidade";
      description: string;
    };

export function stockConsumptionDisplayState(productId?: string | null): StockConsumptionDisplayState {
  if (!shouldSuppressStockConsumptionIntelligence(productId)) return { kind: "available" };
  return {
    kind: "semantic_review",
    title: "Consumo aguardando revisão da unidade",
    description:
      "O histórico deste item usa unidades diferentes ao longo do tempo. Saldo e movimentações continuam válidos; a previsão foi pausada para evitar uma estimativa incorreta.",
  };
}
