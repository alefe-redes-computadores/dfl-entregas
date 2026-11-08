/** R299 P8: metadata puramente visual da exportação. Não altera o acerto financeiro. */
export type SettlementImageMode = 'summary' | 'detailed';
export const settlementImagePolicy = (mode:SettlementImageMode) => ({
  mode,
  detailed: mode === 'detailed',
  title: mode === 'detailed' ? 'Acerto detalhado' : 'Acerto resumido',
  suffix: mode === 'detailed' ? 'detalhado' : 'resumido',
  // Limite de memória da imagem longa preservado; o resumo usa tamanho fixo.
  detailedRowLimit: 72,
  summaryCanvasHeight: 1490,
  // Compartilhar não é prova de entrega pelo WhatsApp.
  shareNote: 'Confira o destinatário; compartilhar não confirma recebimento.',
}) as const;
