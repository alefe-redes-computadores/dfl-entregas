/**
 * GATE E R244 — ensaio OPERACIONAL de entrega Combo V3, sem entrada comercial.
 * Exibe dois pedidos SIMULADOS no mesmo endereço sem mesclar unidades, total
 * ou cliente. Nunca importar em Store, API, Firestore, mensageria ou impressoras.
 */
import type { SiteV3CertificationModel, SiteV3Unit } from './site-combo-v3-certification';
import { printedColumns, wrapThermal, simulatedComboV3Receipt, type ThermalWidth } from './site-combo-v3-thermal-preview';

export const SITE_V3_DISPATCH_SIMULATION_ONLY = true as const;
export const SITE_V3_DISPATCH_PRODUCTION_ENABLED = false as const;

export type DemoV3Order = Readonly<{
  code: string;
  customer: string;
  address: string;
  model: SiteV3CertificationModel;
}>;

export type DemoV3Dispatch = Readonly<{
  kind: 'simulated_only';
  canCreateDelivery: false;
  canSendMessage: false;
  canPrint: false;
  canPersist: false;
  noAutoMerge: true;
  orders: readonly DemoV3Order[];
  routeCards: readonly string[];
  operatorNotes: readonly string[];
  driverPreview: readonly string[];
}>;

const UNPRINTABLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
function check(ok: unknown, reason: string): asserts ok { if (!ok) throw Error(`SITE_V3_DISPATCH_DEMO_${reason}`); }
function safeLabel(value: unknown, max = 160): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    value.trim().length > 0 && !UNPRINTABLE.test(value);
}
function safeModel(model: SiteV3CertificationModel) {
  check(model && model.state === 'certification_only' && model.orderSchemaVersion === 3 &&
    model.canPersist === false && model.canRelay === false &&
    model.canCharge === false && model.canPrint === false, 'UNSAFE_MODEL');
  check(Number.isInteger(model.comboCount) && model.comboCount > 0 && model.comboCount <= 30 &&
    Number.isInteger(model.unitCount) && model.unitCount > 0 && model.unitCount <= 1800 &&
    Array.isArray(model.units) && model.units.length === model.unitCount, 'INVALID_COUNTS');
  check(Number.isSafeInteger(model.totalCents) && model.totalCents >= 0, 'INVALID_TOTAL');
}
function unitSummary(unit: SiteV3Unit): string[] {
  const lines = [`${unit.componentLabel} ${unit.unitNumber}/${unit.groupQuantity} [${unit.key}]`];
  for(const addon of unit.addons) lines.push(`+ ${addon.label}`);
  for(const removal of unit.removals) lines.push(`SEM ${removal.label}`);
  if(unit.note) lines.push(`OBS: ${unit.note}`);
  if(!unit.addons.length && !unit.removals.length && !unit.note) lines.push('PADRAO');
  return lines;
}

/** Somente casos sintéticos prefixados, nenhum nome/código real. */
export function makeSiteV3Simulation(model: SiteV3CertificationModel): DemoV3Dispatch {
  safeModel(model);
  const commonAddress = 'RUA EXEMPLO, 123 - BAIRRO TESTE';
  const orders: readonly DemoV3Order[] = [
    {code:'DEMO-V3-1001',customer:'CLIENTE TESTE A',address:commonAddress,model},
    {code:'DEMO-V3-1002',customer:'CLIENTE TESTE B',address:commonAddress,model},
  ];
  const codes = new Set<string>();
  for(const order of orders) {
    check(/^DEMO-V3-[0-9]{4}$/.test(order.code) && !codes.has(order.code), 'DUPLICATE_ORDER');
    check(safeLabel(order.customer) && safeLabel(order.address), 'UNSAFE_LABEL');
    codes.add(order.code);
  }
  const routeCards = orders.map(order => `${order.code} · ${order.customer} · ${order.address} · ${order.model.unitCount} unidades`);
  const operatorNotes: string[] = [];
  const driverPreview: string[] = [
    'SIMULACAO - NAO ENVIAR AO MOTOBOY',
    'Mesmo endereco, DOIS pedidos distintos. Conferir codigos e volumes separadamente.',
  ];
  for(const order of orders) {
    const prefix = `${order.code} | ${order.customer}`;
    operatorNotes.push(`${prefix} | ${order.address}`);
    driverPreview.push(`PEDIDO ${order.code} | ${order.customer} | ${order.address}`);
    for(const unit of order.model.units) {
      const lines=unitSummary(unit);
      for(const line of lines) operatorNotes.push(`${order.code} | ${line}`);
    }
    driverPreview.push(`VOLUMES ${order.code}: ${order.model.unitCount} unidades; NENHUM VALOR/AJUSTE DE PAGAMENTO AUTORIZADO`);
  }
  return Object.freeze({kind:'simulated_only',canCreateDelivery:false,canSendMessage:false,
    canPrint:false,canPersist:false,noAutoMerge:true,orders,routeCards,
    operatorNotes,driverPreview});
}

/** Uma bobina por pedido; nenhuma junção por telefone, nome ou endereço. */
export function simulatedDispatchReceipt(order: DemoV3Order, width: ThermalWidth): readonly string[] {
  check(width === 58 || width === 80, 'WIDTH');
  check(/^DEMO-V3-[0-9]{4}$/.test(order.code) && safeLabel(order.customer) &&
    safeLabel(order.address), 'ORDER_IDENTITY');
  safeModel(order.model);
  const cols=width===58?30:42;
  const lines = [
    'SIMULACAO - NAO IMPRIMIR',
    ...wrapThermal(`PEDIDO: ${order.code}`,cols),
    ...wrapThermal(`CLIENTE: ${order.customer}`,cols),
    ...wrapThermal(`ENDERECO: ${order.address}`,cols),
    ...simulatedComboV3Receipt(order.model,width),
    `FIM ${order.code}`,
  ];
  check(lines.every(line=>printedColumns(line)<=cols), 'OVERFLOW');
  return lines;
}

export function assertSimulationIsolated(batch: DemoV3Dispatch): true {
  check(batch.kind==='simulated_only' && batch.noAutoMerge===true &&
    batch.canCreateDelivery===false && batch.canSendMessage===false &&
    batch.canPersist===false && batch.canPrint===false, 'AUTHORIZATION');
  check(batch.orders.length===2 && batch.orders[0].code!==batch.orders[1].code, 'ORDER_COLLISION');
  check(batch.orders[0].address===batch.orders[1].address &&
    batch.orders[0].customer!==batch.orders[1].customer, 'IDENTITY_COLLISION');
  for(const order of batch.orders) {
    check(batch.routeCards.filter(line=>line.includes(order.code)).length===1, 'ROUTE_CARD_COLLISION');
    check(batch.driverPreview.some(line=>line.startsWith(`PEDIDO ${order.code} | `)), 'DRIVER_MISSING');
    for(const width of [58,80] as const) {
      const lines=simulatedDispatchReceipt(order,width);
      check(lines.some(line=>line.includes(order.code)), 'RECEIPT_ID_MISSING');
      check(!lines.some(line=>batch.orders.some(other=>other.code!==order.code && line.includes(other.code))), 'RECEIPT_LEAK');
    }
  }
  return true;
}
