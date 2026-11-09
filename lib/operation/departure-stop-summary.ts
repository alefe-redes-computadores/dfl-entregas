/** Conferência visual pura; não executa leituras nem altera registros. */
export type DepartureSummaryInput = {
  key: string;
  deliveries: Array<{
    id: string;
    origin?: string;
    order_id?: string;
    ifood_id?: string;
    source_system?: string;
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
      const order = String(item.order_id || '').trim();
      const ifood = String(item.ifood_id || '').trim();
      const external = String(item.external_order_id || '').trim();
      if (item.source_system === 'dfl_site' && external) return `Site #${external.slice(-8).toUpperCase()}`;
      if (order && ifood) return `Pedido #${order} · ID iFood ${ifood}`;
      if (order) return `Pedido #${order}`;
      if (ifood) return `ID iFood ${ifood}`;
      if (external) return `Ref. #${external.slice(-8).toUpperCase()}`;
      return 'Sem referência comercial · confira o cadastro';
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
