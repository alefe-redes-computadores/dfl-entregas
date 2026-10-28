/** Conferência visual pura; não executa leituras nem altera registros. */
export type DepartureSummaryInput = {
  key: string;
  deliveries: Array<{
    id: string;
    origin?: string;
    order_id?: string;
    ifood_id?: string;
    external_order_id?: string;
    address_string?: string;
    confirmation_code?: string;
  }>;
};
export type DepartureStopSummary = {
  key: string;
  orderIds: string[];
  warnings: string[];
};
export function departureStopSummary(groups: readonly DepartureSummaryInput[]): DepartureStopSummary[] {
  return groups.map((group) => {
    const orderIds = group.deliveries.map((item) => {
      const raw = (item.origin === 'ifood' ? item.ifood_id : '') || item.order_id || item.external_order_id;
      const reference = String(raw || '').trim();
      return reference ? `#${reference}` : `Pedido sem número (${item.id})`;
    });
    const warnings: string[] = [];
    if (group.deliveries.some((item) => !String(item.address_string || '').trim())) {
      warnings.push('Revisar endereço');
    }
    if (group.deliveries.some((item) => item.origin === 'ifood' && !/^\d{4}$/.test(String(item.confirmation_code || '').replace(/\D/g, '')))) {
      warnings.push('Código iFood pendente');
    }
    return { key: group.key, orderIds, warnings };
  });
}
