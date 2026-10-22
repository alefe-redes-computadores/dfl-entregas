/**
 * DFL V111 R23 — whitelist de dados projetados. Nunca espalhar ...data
 * de routes/deliveries/stock_products/stock_supplies para um funcionario.
 * Sem numero de telefone, endereco, preco, forma de pagamento, acerto ou observacao.
 */
export interface ProjectedStaffRow {
  title: string;
  subtitle: string;
  status: string;
}
type RecordData = Record<string, unknown>;
const asRecord = (value: unknown): RecordData =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
const clean = (value: unknown, max = 100) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const qty = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? String(Math.round(value * 1000) / 1000).replace('.', ',') : '—';
const int = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(999, Math.floor(value)) : 0;

export function projectRoute(value: unknown, id: string): ProjectedStaffRow {
  const x = asRecord(value);
  return {
    title: clean(x.name, 90) || `Rota ${clean(id, 16)}`,
    subtitle: clean(x.date, 32) || clean(x.operational_date, 32) || 'Rota atribuída',
    status: x.status === 'fechada' ? 'Finalizada' : 'Em andamento',
  };
}
export function projectDelivery(value: unknown, id: string): ProjectedStaffRow {
  const x = asRecord(value);
  const cancelled = x.source_system === 'dfl_site' &&
    ['cancelado','cancelada','cancelled','canceled'].includes(String(x.site_order_status ?? '').trim().toLowerCase());
  return {
    title: `Entrega ${clean(id, 18)}`,
    subtitle: cancelled ? 'Pedido cancelado' : x.completed === true ? 'Entrega concluída' : 'Entrega pendente',
    status: cancelled ? 'Cancelada' : x.completed === true ? 'Concluída' : 'Pendente',
  };
}
export function projectProduct(value: unknown, id: string): ProjectedStaffRow {
  const x = asRecord(value);
  return {
    title: clean(x.name, 90) || `Produto ${clean(id, 14)}`,
    subtitle: `Saldo: ${qty(x.current_quantity)} ${clean(x.unit, 8)}`.trim(),
    status: x.active === false ? 'Inativo' : 'Estoque',
  };
}
export function projectPurchase(value: unknown, id: string): ProjectedStaffRow {
  const x = asRecord(value);
  return {
    title: `Compra ${clean(id, 16)}`,
    subtitle: `${Array.isArray(x.items) ? Math.min(x.items.length, 999) : int(x.item_count)} itens`,
    status: clean(x.status, 24) || 'Em acompanhamento',
  };
}
export function projectHome(counts: {routes: number; deliveries: number; stock: number; purchases: number}): ProjectedStaffRow {
  return {
    title: 'Resumo das minhas áreas',
    subtitle: `${int(counts.routes)} rotas · ${int(counts.deliveries)} entregas · ${int(counts.stock)} produtos · ${int(counts.purchases)} compras`,
    status: 'Disponível',
  };
}
/** O documento de funcionário nunca recebe privilegios sensiveis ou de escrita. */
export const STAGED_READ_PERMISSIONS = ['home','routes_read','deliveries_read','stock_read','purchases_read'] as const;
export type ReadPermission = typeof STAGED_READ_PERMISSIONS[number];
export function stageReadPermissions(values: unknown): ReadPermission[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((item): item is ReadPermission =>
    typeof item === 'string' && (STAGED_READ_PERMISSIONS as readonly string[]).includes(item)))];
}
