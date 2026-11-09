
import type { Delivery, Route, Customer } from '@/types';
import { resolveStopLocation, buildGoogleMapsRouteUrl, cleanAddressForMaps } from '@/lib/maps';
import { routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { canonicalizeOperationalAddress, bestOperationalAddress, hasHouseNumber } from "@/lib/operational-address";
import { deliveryStopKey, stopNumberMap, groupDeliveriesByStop } from '@/lib/route-stops';
import { routeCashFlow } from '@/lib/route-cash-flow';
import { buildRouteChangePlan } from '@/lib/route-change-plan';
import { deriveDeliveryPaymentState } from '@/lib/delivery-finance';
import { orderConfirmationCode } from '@/lib/operation/ifoodOrderCode';
import { deliverySplitStatus } from '@/lib/delivery-payment-split';

/** Endereco publico unico do iFood; abrir o link nunca confirma pedido no DFL. */
export const IFOOD_DRIVER_CONFIRMATION_URL = 'https://confirmacao-entrega-propria.ifood.com.br/';

const formatMoney = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const deliveryCharge = (delivery: Delivery) => delivery.customer_charge ?? delivery.value ?? 0;
const deliveryGroupKey = deliveryStopKey;

// R119: instrucoes finais com ID por pedido, sem inferir codigo de outro pedido.
// R221: detalhes do ID e codigo ficam no pedido; o link aparece uma so vez,
// ao fim da mensagem. Rotas inteiras mantem listagem quando nao houve resumo.
const ifoodPortalLines = (items: readonly Delivery[], alreadyListed = false): string[] => {
  const orders = items.filter(item => item.origin === 'ifood');
  if (!orders.length) return [];
  const lines = ['', '🔴 *CONFIRMAÇÃO IFOOD*'];
  if (!alreadyListed) {
    lines.push(orders.length > 1 ? '*Pedidos a confirmar:*' : '*Pedido a confirmar:*');
    orders.forEach((item, index) => {
      const id = (item.ifood_id || '').replace(/\D/g, '');
      const code = orderConfirmationCode(item.confirmation_code);
      const prefix = orders.length > 1 ? `${index + 1}. ` : '';
      const label = item.customer_name?.trim() || (item.order_id ? `Pedido #${item.order_id}` : 'Pedido iFood');
      lines.push(`${prefix}*${label}* · ${id.length === 8 ? `ID ${id}` : 'ID ausente — solicite à loja'}`);
      lines.push(code ? `🔑 Código: *${code}*` : '🔑 Código: pedir 4 dígitos ao cliente');
    });
  }
  lines.push(orders.length > 1
    ? '🔑 *Ação:* confira o código e confirme cada pedido separadamente no portal.'
    : '🔑 *Ação:* confira o código com o cliente e confirme este pedido no portal.');
  lines.push('⚠️ Salvar o código no DFL ou abrir o link não confirma a entrega no iFood.');
  lines.push('', '🌐 *Abrir portal de confirmação:*', IFOOD_DRIVER_CONFIRMATION_URL);
  return lines;
};


type ParsedDrinkItem = {
  qty: number;
  name: string;
};

/** R300 P3: local normalization so VM-isolated R85 message contracts stay compatible.
 * Keep unknown input untouched. Do not infer quantities or add external imports.
 */
const canonicalizeRouteDrinkName = (raw: string): string => {
  const name = String(raw || '').trim();
  if (!/^(?:coca|fanta|guaran[aá]|kuat|sprite|pepsi|schweppes|del\s+valle|suco|[aá]gua|refrigerante|refri|soda|t[oô]nica|cerveja|heineken|energ[eé]tico|red\s*bull)\b/i.test(name)) return name;
  return name
    .replace(/^coca\s*[- ]\s*cola\b/i, 'COCA')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:litros?|l)\b/gi, (_, amount: string) => `${amount}L`)
    .replace(/\b(\d{2,4})\s*ml\b/gi, (_, amount: string) => `${amount}ML`)
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR')
    .trim();
};

const parseDrinkItems = (raw?: string): ParsedDrinkItem[] => {
  if (!raw?.trim()) return [];

  return raw
    .split(/\s*(?:,|;|\+|\n)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(?:(\d+)\s*[xX]?\s+|([0-9]+)[xX]\s*)(.+)$/);
      if (!match) return { qty: 1, name: canonicalizeRouteDrinkName(part) };

      const qty = Number(match[1] || match[2] || 1);
      const name = canonicalizeRouteDrinkName((match[3] || part).trim());

      return {
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        name,
      };
    });
};

const getOriginLabel = (delivery: Delivery): string => {
  if (delivery.origin === 'ifood') return 'iFood';
  if (delivery.origin === 'keeta') return 'Keeta';
  if (delivery.origin === 'food99') return '99Food';
  if (delivery.origin === 'loja') return 'Loja própria';
  return 'Origem não registrada';
};

// Telefone de contato para exibição. Nunca inventar DDD ou alterar números fixos.
export const formatOperationalPhone = (raw?: string | null): string => {
  let digits = (raw || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length === 10 && /^[1-9]\d[6-9]/.test(digits)) digits = `${digits.slice(0,2)}9${digits.slice(2)}`;
  return digits.length === 11 || digits.length === 10 ? digits : '';
};

const deliveryPaid = (item: Delivery) => deriveDeliveryPaymentState(item) === 'paid';
const firstName = (value: string) => value.trim().split(/\s+/)[0] || 'Cliente';
const deliveryOrigin = (item: Delivery) => item.source_system === 'dfl_site' ? 'SITE' : item.origin === 'ifood' ? 'IFOOD' : 'LOJA';

/** R288: acao financeira, nunca usar metodo de pagamento como prova de quitacao. */
function driverCollectionInstruction(item: Delivery): string {
  if (deliveryPaid(item)) return 'Pago ✅';
  const value = `R$ ${formatMoney(deliveryCharge(item))}`;
  const split = deliverySplitStatus(item);
  if (split?.valid) return `Cobrar ${value} · pagamento dividido (conferir formas)`;
  if (item.payment_method === 'pix') return `Cobrar ${value} no Pix (QR/chave da loja) · confirmar recebimento`;
  if (item.payment_method?.includes('cartao')) return `Cobrar ${value} na maquininha`;
  if (item.payment_method === 'dinheiro' || !item.payment_method) {
    const received = Number(item.change_for) || 0;
    const change = Math.max(0, received - deliveryCharge(item));
    return change > 0
      ? `Cobrar ${value} em dinheiro · cliente entrega R$ ${formatMoney(received)} · troco R$ ${formatMoney(change)}`
      : `Cobrar ${value} em dinheiro`;
  }
  return `Cobrar ${value} · ${(item.payment_method || 'a conferir').replace(/_/g,' ')}`;
}

export async function copyDeliveryToClipboard(
  delivery: Delivery,
  customerName?: string,
  savedCustomerCode?: string,
  relatedDeliveries: Delivery[] = [delivery],
  stopPosition?: number,
  ifoodConfirmationMode: 'store' | 'motoboy' = 'store',
  messageDetailMode: 'compact' | 'guided' = 'compact',
): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood';
    const driverConfirmsIfood = ifoodConfirmationMode === 'motoboy';
    const valueStr = formatMoney(deliveryCharge(delivery));
    // R110 P4: mensagem financeira segmentada; nunca presumir quitacao de parcelas.
    const paymentSplit = deliverySplitStatus(delivery);
    const isUrgent = delivery.is_urgent;
    // `savedCustomerCode` é mantido na assinatura por compatibilidade dos chamadores,
    // mas nunca confirma um pedido diferente do histórico do cliente.
    const currentCode = orderConfirmationCode(delivery.confirmation_code);
    const clientPhone = formatOperationalPhone(delivery.phone);

    parts.push(`📦 *ENTREGA${stopPosition && stopPosition > 0 ? ` ${getNumberEmoji(stopPosition)}` : ''} · ${deliveryOrigin(delivery)}*`);
    if (isUrgent) parts.push(`🚨 *ATENÇÃO: ENTREGA URGENTE* 🚨`);
    parts.push('');

    const groupedOrders = Array.from(
      new Map(relatedDeliveries.map((item) => [item.id, item])).values(),
    );
    if (groupedOrders.length > 1) {
      const groupedPending = groupedOrders.filter(item => !deliveryPaid(item));
      const groupedTotal = groupedPending.reduce((sum, item) => sum + deliveryCharge(item), 0);
      parts.push(`📦 *${groupedOrders.length} PEDIDOS · 1 PARADA*`);
      parts.push(groupedPending.length===0?'✅ *Todos os pedidos estão pagos*':groupedPending.length===groupedOrders.length?`💵 *Cobrar na parada: R$ ${formatMoney(groupedTotal)}*`:`⚠️ *Alguns pedidos pagos · cobrar R$ ${formatMoney(groupedTotal)} dos pendentes*`);
      groupedOrders.forEach((item, index) => {
        const itemName = item.customer_name || (item.id === delivery.id ? customerName : '') || 'Cliente';
        const itemOrigin = item.source_system === 'dfl_site' ? 'Site' : item.origin === 'ifood' ? 'iFood' : 'Loja';
        const itemReference = item.origin === 'ifood' && item.ifood_id
          ? `ID *${item.ifood_id}*`
          : item.order_id ? `pedido *#${item.order_id}*` : 'sem identificador';
        const itemCode = orderConfirmationCode(item.confirmation_code);
        const itemSplit = deliverySplitStatus(item);
        const payment = driverCollectionInstruction(item);
        parts.push(`${index + 1}. *${itemName}* · ${itemOrigin} · ${itemReference}`);
        if (item.origin === 'ifood') parts.push(driverConfirmsIfood
          ? itemCode ? `   🔑 Código: *${itemCode}* · confirmar no portal` : '   🔑 *Pedir código de 4 dígitos e confirmar no portal*'
          : itemCode ? `   🔑 Código: *${itemCode}*` : '   🔑 *Pedir código de 4 dígitos*');
        if (driverConfirmsIfood && item.origin === 'ifood' && !item.ifood_id) parts.push('   ⚠️ *ID iFood ausente — solicitar à loja*');
        parts.push(`   ${payment}`);
        if (itemSplit?.valid && !deliveryPaid(item)) {
          if (itemSplit.cashCents) parts.push(`   💵 Dinheiro: R$ ${formatMoney(itemSplit.cashCents / 100)}`);
          if (itemSplit.cardCents) parts.push(`   💳 Cartão: R$ ${formatMoney(itemSplit.cardCents / 100)} · levar maquininha`);
          if (itemSplit.pixCents) parts.push(`   📱 Pix: R$ ${formatMoney(itemSplit.pixCents / 100)} · conferir recebimento`);
          if (itemSplit.changeCents) parts.push(`   🔁 Troco: R$ ${formatMoney(itemSplit.changeCents / 100)}`);
        }
      });
      parts.push('', '📍 *Uma parada física · entregar cada pedido separadamente*');
      const address = routeAddressParts(delivery.address_string);
      parts.push(`📍 *Destino:* ${address.neighborhood} · ${address.streetWithNumber}`);
      const mapLink=delivery.maps_link||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddressForMaps(delivery.address_string))}`;
      // Mapa único por parada; não repetir instruções numéricas do portal.
      parts.push('', '🗺️ *Abrir no mapa:*', mapLink);
      if (driverConfirmsIfood && groupedOrders.some(item => item.origin === 'ifood')) {
        if (messageDetailMode === 'guided') parts.push(...ifoodPortalLines(groupedOrders, true));
        else parts.push('🔴 Confirme cada ID iFood individualmente no portal:', IFOOD_DRIVER_CONFIRMATION_URL);
      }
      await navigator.clipboard.writeText(parts.join('\n'));
      return true;
    }

    parts.push(`👤 *${customerName || delivery.customer_name || 'Cliente'}*${isIfood && delivery.ifood_id ? ` · ID *${delivery.ifood_id}*` : ''}`);

    if (isIfood) {
      if (!delivery.ifood_id && delivery.order_id) parts.push(`🧾 *Pedido #${delivery.order_id}*`);

      if (currentCode) {
        parts.push(driverConfirmsIfood ? `🔑 *Código iFood:* \`${currentCode}\` · *CONFIRMAR NO PORTAL*` : `🔑 *Código iFood:* \`${currentCode}\` ✅`);
      } else {
        parts.push(driverConfirmsIfood ? `🔑 *Pedir código de 4 dígitos · confirmar no portal*` : `🔑 *Pedir código de 4 dígitos ao cliente*`);
      }
      if (driverConfirmsIfood && !delivery.ifood_id) parts.push('⚠️ *ID iFood ausente — pedir à loja antes de confirmar*');
    } else {
      if (delivery.order_id) parts.push(`🧾 *Pedido #${delivery.order_id}*`);
    }

    const individualAddress = routeAddressParts(delivery.address_string);
    parts.push(`📍 *Destino:* ${individualAddress.streetWithNumber} · *${individualAddress.neighborhood}*`);
    if (delivery.manual_order_items && delivery.origin === 'loja') parts.push(`🛍️ *Pedido:* ${delivery.manual_order_items}`);
    if (delivery.observation) parts.push(/\b(?:urgente|cuidado|aten[cç][aã]o|perigo|endere[cç]o incompleto)\b/i.test(delivery.observation) ? `⚠️ *ATENÇÃO:* ${delivery.observation}` : `📝 *Referência:* ${delivery.observation}`);

    if (clientPhone) {
      parts.push(`📲 *Contato:* *${clientPhone}*`);
    }

    if (deliveryPaid(delivery)) {
      parts.push(`✅ *Pagamento:* Pago`);
    } else if (paymentSplit?.valid) {
      parts.push(`💰 *Pagamento dividido · cobrar R$ ${valueStr}*`);
      if (paymentSplit.cashCents) parts.push(`💵 *Dinheiro:* R$ ${formatMoney(paymentSplit.cashCents / 100)}`);
      if (paymentSplit.cardCents) parts.push(`💳 *Cartão:* R$ ${formatMoney(paymentSplit.cardCents / 100)} · *levar maquininha*`);
      if (paymentSplit.pixCents) parts.push(`📱 *Pix:* R$ ${formatMoney(paymentSplit.pixCents / 100)} · *conferir recebimento*`);
      if (paymentSplit.changeCents) parts.push(`🔁 *Troco:* R$ ${formatMoney(paymentSplit.changeCents / 100)}`);
    } else {
      const pMethod = delivery.payment_method?.toUpperCase().replace('_', ' ') || 'PAGAMENTO';
      if (delivery.payment_method === 'dinheiro') {
        if (delivery.change_for) {
          const troco = Math.max(0, delivery.change_for - deliveryCharge(delivery));
          parts.push(`💵 *Cobrar:* R$ ${valueStr} · dinheiro`);
          parts.push(`↳ Cliente paga com R$ ${formatMoney(delivery.change_for)}`);
          parts.push(`↳ 🔁 *Troco: R$ ${formatMoney(troco)}*`);
        } else {
          parts.push(`💵 *Cobrar:* R$ ${valueStr} · dinheiro`);
        }
      } else if (delivery.payment_method?.includes('cartao') || (delivery.payment_method as string) === 'cartao') {
        parts.push(`💳 *Cobrar R$ ${valueStr} na maquininha*`);
      } else if (delivery.payment_method === 'pix') {
        parts.push(`📱 *Cobrar R$ ${valueStr} no Pix (QR/chave da loja)*`);
        parts.push(`✅ Confirmar recebimento antes de marcar como pago`);
      } else {
        parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr}`);
      }
    }

    if (delivery.drinks) parts.push(`🥤 *Bebida:* *${delivery.drinks.trim()}*`);
    parts.push('');

    if (delivery.maps_link) {
      parts.push(`🗺️ *Mapa:*`); parts.push(delivery.maps_link);
    } else {
      const cleanAddress = cleanAddressForMaps(delivery.address_string);
      parts.push(`🗺️ *Mapa:*`); parts.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`);
    }

    if (driverConfirmsIfood && isIfood) {
      if (messageDetailMode === 'guided') parts.push(...ifoodPortalLines([delivery], true));
      else parts.push('🔴 Confirme este ID iFood no portal:', IFOOD_DRIVER_CONFIRMATION_URL);
    }
    const textToCopy = parts.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    return true;
  } catch (error) {
    console.error('Falha ao copiar entrega:', error);
    return false;
  }
}

export function generateClientDispatchUrl(customerName: string, phone: string, motoboyName: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const firstName = customerName.split(' ')[0] || 'Cliente';
  const text = `Olá, ${firstName}! 👋\nSeu pedido da *Da Família Lanches* acabou de sair para entrega com o entregador *${motoboyName}* e logo chega aí! 🛵💨`;
  return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
}

const getNumberEmoji = (num: number): string => {
  const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  return emojis[num] || `${num}️⃣`;
};

const formatDuration = (startTimeStr?: string, endTimeStr?: string): string | null => {
  if (!startTimeStr || !endTimeStr) return null;
  const start = firstValidTimestamp(startTimeStr);
  const end = firstValidTimestamp(endTimeStr);
  if (!start || !end || end.getTime() <= start.getTime()) return null;

  const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  if (hours > 0) return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  return `${mins}min`;
};

function routeAddressParts(
  deliveryAddress?: string,
  customerAddress?: string,
  customerNeighborhood?: string,
) {
  const best =
    bestOperationalAddress(
      deliveryAddress,
      customerAddress,
    ) || '';

  const canonical =
    canonicalizeOperationalAddress(
      best,
      customerNeighborhood,
    );

  const neighborhood =
    canonical.neighborhood ||
    customerNeighborhood ||
    'Bairro não inf.';

  const normalizedNeighborhood =
    neighborhood
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();

  const segments = canonical.address
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const streetWithNumber =
    segments.find((part) => {
      const normalizedPart = part
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim();

      return normalizedPart !== normalizedNeighborhood;
    }) ||
    canonical.address ||
    'Endereço não informado';

  /*
   * Para desempatar duas paradas do mesmo bairro no WhatsApp,
   * mostramos somente a via. O endereço operacional completo
   * continua intacto em fullAddress.
   *
   * Ex.: "Rua Major Gote, 123" -> "Rua Major Gote".
   */
  const street =
    streetWithNumber
      .replace(/,\s*\d{1,6}[A-Za-z]?\b.*$/i, '')
      .replace(/\s+-\s*\d{1,6}[A-Za-z]?\b.*$/i, '')
      .trim() ||
    streetWithNumber;

  return {
    neighborhood,
    street,
    streetWithNumber,
    fullAddress:
      canonical.address ||
      'Endereço não informado',
  };
}

export async function generateRouteMessages(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  getCustomerById: (id: string) => Customer | undefined,
  previousRoute?: Route | null,
  ifoodConfirmationMode: 'store' | 'motoboy' = 'store',
  messageDetailMode: 'compact' | 'guided' = 'compact',
): Promise<{ success: boolean; hasFuzzyAddresses: boolean; fuzzyList: any[]; messages: string[] }> {
  try {
    let hasFuzzyAddresses = false;
    const fuzzyDeliveries: any[] = [];

    const msg1: string[] = [];
    const msg2: string[] = [];
    const driverConfirmsIfood = ifoodConfirmationMode === 'motoboy';

    const totalDeliveries = deliveries.length;
    const deliveriesByStop = new Map<string, Delivery[]>();
    for (const delivery of deliveries) {
      const key = deliveryGroupKey(delivery);
      const grouped = deliveriesByStop.get(key);
      if (grouped) grouped.push(delivery);
      else deliveriesByStop.set(key, [delivery]);
    }
    const totalStops = deliveriesByStop.size;
    const physicalStopNumbers = stopNumberMap(deliveries);
    const drinksSummary: Record<string, { qty: number; name: string }> = {};
    const stopsNeedingCode: { num: number; neighborhood: string; street: string; client: string }[] = [];
    const stopsNeedingCall: { num: number; name: string; phone: string }[] = [];
    const stopsNeedingPosMachine: { num: number; name: string; neighborhood: string; amount: number }[] = [];

    msg1.push(`──────────────`);
    const matchRouteNumber = route.name.match(/\d+/);
    const routeNumber = matchRouteNumber ? parseInt(matchRouteNumber[0], 10) : 1;

    msg1.push(`🏍️ *Rota ${routeNumber} · ${route.motoboy_name}*`);
    msg1.push(totalStops===totalDeliveries?`📦 *${totalDeliveries} ${totalDeliveries===1?'entrega':'entregas'}*`:`📦 *${totalDeliveries} pedidos · ${totalStops} ${totalStops===1?'parada':'paradas'}*`);

    if (previousRoute) {
      const prevDuration = formatDuration(
        routeStartedAt(previousRoute),
        previousRoute.end_time,
      );

      if (prevDuration) {
        const matchPrev = previousRoute.name.match(/\d+/);
        const prevNum = matchPrev ? matchPrev[0] : 'anterior';
        msg1.push(`⏱️ *Rota anterior (Rota ${prevNum}):* ${prevDuration}`);
      }
    }

    msg1.push(`──────────────`);
    msg1.push(`📍 *PARADAS · ORDEM DE ENTREGA*`);
    // R148 R2: classificar canais sem introduzir dependencias no gerador,
    // preservando os contratos legados de mensagens e de codigo individual iFood.
    const channelCounts = { ifood: 0, food99: 0, site: 0, store: 0, unknown: 0 };
    for (const delivery of deliveries) {
      const origin = String(delivery.origin || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
      const source = String(delivery.source_system || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (origin === 'ifood' || source === 'ifood') channelCounts.ifood++;
      else if (origin === '99food' || origin === 'food99' || source === '99food' || source === 'food99') channelCounts.food99++;
      else if (source === 'dflsite' || origin === 'dflsite' || origin === 'site') channelCounts.site++;
      else if (origin === 'loja' || origin === 'manual') channelCounts.store++;
      else channelCounts.unknown++;
    }
    const ifoodCount = channelCounts.ifood;
    const originSummaryParts: string[] = [];
    if (channelCounts.ifood > 0) originSummaryParts.push(`${channelCounts.ifood} iFood`);
    if (channelCounts.food99 > 0) originSummaryParts.push(`${channelCounts.food99} 99Food`);
    if (channelCounts.site > 0) originSummaryParts.push(`${channelCounts.site} Site DFL`);
    if (channelCounts.store > 0) originSummaryParts.push(`${channelCounts.store} Loja`);
    if (channelCounts.unknown > 0) originSummaryParts.push(`${channelCounts.unknown} origem não identificada`);

    if (originSummaryParts.length > 0) {
      msg1.push(`🧾 *Origem:* ${originSummaryParts.join(' · ')}`);
    }
    msg1.push('');

    const routeMapAddresses: string[] = [];
    const seenStopGroups = new Set<string>();
    const firstStopNumber = new Map<string, number>();
    const seenCodesByGroup = new Map<string, Set<string>>();

    const neighborhoodCounts = (() => {
      const counts: Record<string, number> = {};
      const seenGroups = new Set<string>();

      deliveries.forEach((delivery) => {
        const groupKey = deliveryGroupKey(delivery);
        if (seenGroups.has(groupKey)) return;
        seenGroups.add(groupKey);

        const customer = getCustomerById(delivery.customer_id);
        const parts = routeAddressParts(
          delivery.address_string,
          customer?.address,
          customer?.neighborhood,
        );

        counts[parts.neighborhood] = (counts[parts.neighborhood] || 0) + 1;
      });

      return counts;
    })();

    groupDeliveriesByStop(deliveries).forEach((stopGroup, stopIndex) => {
      const stopNumber = stopIndex + 1;
      const emojiNum = getNumberEmoji(stopNumber);
      const representative = stopGroup.representative;
      const customer = getCustomerById(representative.customer_id);
      const addressParts = routeAddressParts(representative.address_string, customer?.address, customer?.neighborhood);
      const neighborhood = addressParts.neighborhood;
      const street = addressParts.fullAddress;
      const streetOnly = addressParts.street;
      const stopClientNames = Array.from(
        new Set(
          stopGroup.deliveries
            .map((item) => {
              const itemCustomer = getCustomerById(item.customer_id);
              return itemCustomer?.name || item.customer_name || '';
            })
            .filter(Boolean),
        ),
      );
      const clientName = stopClientNames.length > 1
        ? stopClientNames.join(' + ')
        : stopClientNames[0] || customer?.name || representative.customer_name || 'Cliente';
      const clientPhone = formatOperationalPhone(representative.phone || customer?.phone);

      if (!hasHouseNumber(street) && !customer?.maps_link) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: representative.id, index: stopNumber, name: clientName, address: representative.address_string, neighborhood });
      }
      routeMapAddresses.push(resolveStopLocation(representative, customer?.maps_link));

      const ifoodOrders = stopGroup.deliveries.filter((item) => item.origin === 'ifood');
      const stopTotal = stopGroup.deliveries.reduce((sum, item) => sum + deliveryCharge(item), 0);
      msg1.push(`*${emojiNum} ${clientName}*`);
      msg1.push(`📍 *${neighborhood}* · ${addressParts.streetWithNumber}`);
      const stopToCollect = stopGroup.deliveries.filter((item) => !deliveryPaid(item)).reduce((sum, item) => sum + deliveryCharge(item), 0);
      if (stopGroup.deliveries.length > 1) {
        const paidCount=stopGroup.deliveries.filter(deliveryPaid).length;
        const paymentSummary=stopToCollect>0
          ? paidCount>0?`⚠️ pagamento misto · cobrar R$ ${formatMoney(stopToCollect)}`: `💵 cobrar R$ ${formatMoney(stopToCollect)}`
          : '✅ tudo pago';
        msg1.push(`📦 *${stopGroup.deliveries.length} pedidos nesta parada* · ${paymentSummary}`);
      }

      const codes = ifoodOrders.map((item) => orderConfirmationCode(item.confirmation_code));
      const missingIfoodCode = codes.some((code) => !code);
      if (ifoodOrders.length === 1 && stopGroup.deliveries.length === 1) {
        // O pedido ja mostra seu codigo em uma unica linha; nao repetir alerta em caps.
        if (!codes[0]) stopsNeedingCode.push({ num: stopNumber, neighborhood, street: streetOnly, client: firstName(clientName) });
      } else if (missingIfoodCode) {
        // Mesmo que outro pedido da mesma parada tenha código válido.
        stopsNeedingCode.push({ num: stopNumber, neighborhood, street: streetOnly, client: firstName(clientName) });
      }

      stopGroup.deliveries.forEach((item) => {
        const itemCustomer = getCustomerById(item.customer_id);
        const itemCustomerName = itemCustomer?.name || item.customer_name || '';
        const reference = item.origin === 'ifood' && item.ifood_id
          ? `ID *${item.ifood_id}*`
          : item.order_id ? `pedido *#${item.order_id}*` : 'sem identificador';
        const specificCode = orderConfirmationCode(item.confirmation_code);
        const paymentText = driverCollectionInstruction(item);
        if (!deliveryPaid(item) && item.payment_method?.includes('cartao')) {
          stopsNeedingPosMachine.push({ num: stopNumber, name: firstName(itemCustomerName || clientName), neighborhood, amount: deliveryCharge(item) });
        }
        const customerText = stopGroup.deliveries.length > 1 && itemCustomerName ? `*${itemCustomerName}* · ` : '';
        const codeText = item.origin === 'ifood'
          ? driverConfirmsIfood
            ? specificCode ? ` · 🔑 *${specificCode}* · confirmar no portal` : ' · 🚨 *pedir código e confirmar no portal*'
            : specificCode ? ` · 🔑 *${specificCode}*` : ' · 🚨 *pedir código*'
          : '';
        const paymentAction = ` · ${paymentText}`;
        msg1.push(`• ${customerText}${reference}${codeText}${paymentAction}`);

        if (item.manual_order_items?.trim() && item.origin === 'loja') msg1.push(`   🛍️ *Pedido:* ${item.manual_order_items.trim()}`);
        if (item.drinks?.trim()) parseDrinkItems(item.drinks.trim()).forEach(({ qty, name }) => { const key=name.toLowerCase(); if(!drinksSummary[key]) drinksSummary[key]={qty:0,name}; drinksSummary[key].qty+=qty; });
      });

      Array.from(new Set(stopGroup.deliveries.map((item) => item.observation?.trim()).filter(Boolean))).forEach((observation) => msg1.push(`⚠️ *ATENÇÃO:* ${observation}`));

      if (clientPhone) {
        stopsNeedingCall.push({ num: stopNumber, name: firstName(clientName), phone: formatOperationalPhone(clientPhone) });
        msg1.push(`📲 *Contato:* *${formatOperationalPhone(clientPhone)}*`);
      }
      if (driverConfirmsIfood && ifoodOrders.length > 0) {
        if (messageDetailMode === 'guided') msg1.push('', '🔴 *Confirme cada ID iFood individualmente no portal abaixo.*');
        if (ifoodOrders.some(item => !item.ifood_id)) msg1.push('⚠️ ID iFood ausente: peça à loja antes de confirmar.');
      }
      msg1.push(`──────────────`);
    });

    msg1.push(driverConfirmsIfood && ifoodCount > 0 ? `🗺️ *1. ROTA OTIMIZADA:*` : `🗺️ *ROTA OTIMIZADA:*`);
    msg1.push(`⚠️ *Sequência pronta com as paradas. Clique no link e inicie a rota:*`);
    msg1.push('');

    if (routeMapAddresses.length > 0) {
      const mapUrl = buildGoogleMapsRouteUrl(storeAddress, routeMapAddresses);
      msg1.push(mapUrl);
      msg1.push('');
    }

    if (driverConfirmsIfood && ifoodCount > 0 && messageDetailMode === 'guided') {
      msg1.push(...ifoodPortalLines(deliveries, true));
      msg1.push('');
    }

    if (fuzzyDeliveries.length > 0) {
      msg1.push(`*(🚨 Nota: ${fuzzyDeliveries.length === 1 ? 'A parada' : 'As paradas'} ${fuzzyDeliveries.map(f => f.index).join(', ')} possuem endereço simplificado).*`);
      msg1.push('');
    }
    msg1.push(`──────────────`);

    // MENSAGEM 2: CONFERÊNCIA DA ROTA — BAG, CÓDIGOS, TROCO E CAIXA
    const now = new Date();
    const departure = firstValidTimestamp(routeStartedAt(route));
    const shownTime = departure || now;
    const timeString = `${String(shownTime.getHours()).padStart(2, '0')}h${String(shownTime.getMinutes()).padStart(2, '0')}m`;

    msg2.push(`──────────────`);
    msg2.push(`🏍️ *Rota ${routeNumber} · ${route.motoboy_name}*`);
    msg2.push(totalStops===totalDeliveries?`📦 ${totalDeliveries} ${totalDeliveries===1?'entrega':'entregas'} · saída *${timeString}*`:`📦 ${totalDeliveries} pedidos · ${totalStops} ${totalStops===1?'parada':'paradas'} · saída *${timeString}*`);

    if (previousRoute) {
      const prevDuration = formatDuration(
        routeStartedAt(previousRoute),
        previousRoute.end_time,
      );

      if (prevDuration) {
        const matchPrev = previousRoute.name.match(/\d+/);
        const prevNum = matchPrev ? matchPrev[0] : 'anterior';
        // Duração anterior pertence ao relatório, não ao checklist de saída.
      }
    }

    msg2.push(`──────────────`);
    msg2.push(`✅ *CHECKLIST ANTES DE SAIR*`);
    msg2.push('');

    const summarySeenGroups = new Set<string>();
    deliveries.forEach((delivery) => {
      const groupKey = deliveryGroupKey(delivery);
      if (summarySeenGroups.has(groupKey)) return;
      summarySeenGroups.add(groupKey);

      const num = physicalStopNumbers.get(groupKey) || summarySeenGroups.size;
      // Índice montado uma vez; preserva ordem e pedidos cancelados do resumo.
      const groupedDeliveries = deliveriesByStop.get(groupKey) || [];
      const customer = getCustomerById(delivery.customer_id);
      const addressParts = routeAddressParts(
        delivery.address_string,
        customer?.address,
        customer?.neighborhood,
      );
      const neighborhood = addressParts.neighborhood;
      const isDuplicate = neighborhoodCounts[neighborhood] > 1;
      const clientPhone = formatOperationalPhone(delivery.phone || customer?.phone);

      const streetLabel = isDuplicate ? ` (${addressParts.street})` : '';
      const groupDrinks = groupedDeliveries
        .map((candidate) => candidate.drinks?.trim())
        .filter(Boolean)
        .join(' + ');
      const drinkInfo = groupDrinks ? ` · 🥤 *${groupDrinks}*` : '';
      const zapWarning = clientPhone ? ` · 📲 contato` : '';
      const needsCode = groupedDeliveries.some((candidate) => {
        if (candidate.origin !== 'ifood') return false;
        return !orderConfirmationCode(candidate.confirmation_code);
      });
      const needsCashChange = groupedDeliveries.some((candidate) =>
        !deliveryPaid(candidate) &&
        candidate.payment_method === 'dinheiro' &&
        Boolean(candidate.change_for && candidate.change_for > deliveryCharge(candidate))
      );
      const flags = `${needsCode ? ' · 🔑 código' : ''}${needsCashChange ? ' · 💵 troco' : ''}`;

      if(groupedDeliveries.length>1){
        msg2.push(`${getNumberEmoji(num)} *${neighborhood}*${streetLabel} · *${groupedDeliveries.length} pedidos / mesma parada*${zapWarning}`);
        groupedDeliveries.forEach((candidate)=>{
          const candidateCustomer=getCustomerById(candidate.customer_id);
          const candidateName=candidateCustomer?.name||candidate.customer_name||'Cliente';
          const reference=candidate.origin==='ifood'&&candidate.ifood_id?`ID *${candidate.ifood_id}*`:candidate.order_id?`pedido *#${candidate.order_id}*`:'sem identificador';
          const code=orderConfirmationCode(candidate.confirmation_code);
          const codeInfo=candidate.origin==='ifood'
            ? driverConfirmsIfood
              ? code ? ` · 🔑 *${code}* · confirmar no portal` : ' · 🔑 *pedir código e confirmar*'
              : code ? ` · 🔑 *${code}*` : ' · 🔑 *pedir código*'
            : '';
          const candidateDrinks=candidate.drinks?.trim()?` · 🥤 *${candidate.drinks.trim()}*`:'';
          const amount=deliveryCharge(candidate);
          const paymentAction=deliveryPaid(candidate)?'':` · cobrar *R$ ${formatMoney(amount)}* · ${(candidate.payment_method||'dinheiro').replace(/_/g,' ')}`;
          msg2.push(`   ↳ *${candidateName}* · ${reference}${codeInfo}${candidateDrinks}${paymentAction}`);
        });
        const groupedTotal=groupedDeliveries.filter(item=>!deliveryPaid(item)).reduce((sum,item)=>sum+deliveryCharge(item),0);
        if(groupedTotal>0)msg2.push(`   💰 Total da parada a cobrar: *R$ ${formatMoney(groupedTotal)}*`);
        if (driverConfirmsIfood && groupedDeliveries.some(item => item.origin === 'ifood')) {
          // A confirmação iFood aparece uma única vez no rodapé do checklist.
        }
        msg2.push('   📍 *1 parada física · pedidos e códigos separados*');
      }else{
        msg2.push(`${getNumberEmoji(num)} *${neighborhood}*${streetLabel}${drinkInfo}${flags}${zapWarning}`);
        const single = groupedDeliveries[0];
        if (driverConfirmsIfood && single?.origin === 'ifood') {
          const code = orderConfirmationCode(single.confirmation_code);
          msg2.push(`   ↳ ID iFood *${single.ifood_id || 'AUSENTE'}* · ${code ? `código *${code}*` : 'pedir código ao cliente'}`);
          // Link e regra iFood aparecem uma única vez no resumo final.
        }
      }
    });

    msg2.push(`──────────────`);

    const drinkKeys = Object.keys(drinksSummary);
    if (drinkKeys.length > 0) {
      msg2.push(`🥤 *Bebidas desta rota*`);
      msg2.push(`⚠️ *Conferir antes de sair:*`);
      msg2.push('');
      drinkKeys.forEach(key => {
        msg2.push(`  • *${drinksSummary[key].qty}x ${drinksSummary[key].name}*`);
      });
      msg2.push(`──────────────`);
    }

    if (stopsNeedingPosMachine.length > 0) {
      msg2.push(`💳 *COBRANÇAS NO CARTÃO · LEVAR MAQUININHA*`);
      const byStop = new Map<number, { names: string[]; neighborhood: string; amount: number }>();
      stopsNeedingPosMachine.forEach((item) => {
        const entry = byStop.get(item.num) || { names: [], neighborhood: item.neighborhood, amount: 0 };
        if (!entry.names.includes(item.name)) entry.names.push(item.name);
        entry.amount += item.amount;
        byStop.set(item.num, entry);
      });
      byStop.forEach((entry, num) => msg2.push(`  • ${getNumberEmoji(num)} *${entry.names.join(' + ')}* (${entry.neighborhood}) · *R$ ${formatMoney(entry.amount)}*`));
    }
    msg2.push(`──────────────`);

    // LISTA ORGANIZADA DE CÓDIGOS NO FINAL
    if (stopsNeedingCode.length > 0) {
      msg2.push(`🔐 *Confirmações necessárias*`);
      msg2.push(driverConfirmsIfood ? `*Pegar com o cliente e confirmar no portal:*` : `*Pegar com o cliente:*`);
      stopsNeedingCode.forEach((stop) => {
        const duplicateNeighborhood = neighborhoodCounts[stop.neighborhood] > 1;
        msg2.push(`  • ${getNumberEmoji(stop.num)} *${stop.neighborhood}*${duplicateNeighborhood ? ` · ${stop.street}` : ''} (${stop.client})`);
      });
      msg2.push(`──────────────`);
    }

    if (driverConfirmsIfood && ifoodCount > 0) {
      // A mensagem logística já contém portal, IDs e códigos por pedido.
      // Repetir a listagem completa na conferência cria uma segunda versão do mesmo checklist.
      msg2.push(`🔴 *iFood:* confirmar ${ifoodCount} pedido${ifoodCount === 1 ? '' : 's'} individualmente no portal.`);
      msg2.push(IFOOD_DRIVER_CONFIRMATION_URL);
      msg2.push(`──────────────`);
    }

    if (stopsNeedingCall.length > 0) {
      msg2.push(`📲 *Contato rápido*`);
      msg2.push(`Se precisar falar com o cliente:`);
      stopsNeedingCall.forEach(s => {
        msg2.push(`  • ${getNumberEmoji(s.num)} *${s.name}* · 📲 *${s.phone}*`);
      });
      msg2.push(`──────────────`);
    }

    // Motor canonico preservado; destacar apenas troco inicial.
    const cashFlow = routeCashFlow(deliveries, route.change_money);
    if (cashFlow.initialCash > 0) {
      msg2.push('👜 *Troco inicial:* conferir dinheiro da bag antes de sair.');
      msg2.push('──────────────');
    }

    const changePlan = buildRouteChangePlan(
      deliveries,
      route.change_money,
      getCustomerById,
    );
    const msg3: string[] = [];
    msg3.push(`──────────────`);
    msg3.push(`💰 *DINHEIRO DA ROTA · Rota ${routeNumber}*`);
    msg3.push(`🏍️ ${route.motoboy_name}`);
    msg3.push(`Valores que o motoboy recebe, devolve e traz para o caixa.`);
    msg3.push(`──────────────`);

    if (!changePlan.lines.length) {
      msg3.push(`✅ Nenhuma entrega será recebida em dinheiro nesta rota.`);
    } else {
      changePlan.lines.forEach((line) => {
        msg3.push(`${getNumberEmoji(line.stop)} *${line.customer}*`);
        msg3.push(`• Pedido: *R$ ${formatMoney(line.charge)}*`);
        msg3.push(`• Cliente entrega: *R$ ${formatMoney(line.tendered)} em dinheiro*`);
        if (line.change <= 0) {
          msg3.push(`• ✅ Valor exato · sem troco`);
        } else {
          msg3.push(`• Troco total: *R$ ${formatMoney(line.change)}*`);
          if (line.cashChange > 0) msg3.push(`  ↳ 💵 Em espécie: *R$ ${formatMoney(line.cashChange)}*`);
          if (line.pixChange > 0) msg3.push(`  ↳ 📱 Via Pix: *R$ ${formatMoney(line.pixChange)}*`);
        }
        msg3.push(`• Volta desta entrega na bag: *R$ ${formatMoney(line.tendered)}*`);
        msg3.push('');
      });
      msg3.push(`──────────────`);
      msg3.push(`📊 *RESUMO DO DINHEIRO*`);
      msg3.push(`👜 Saiu na bag para troco: *R$ ${formatMoney(changePlan.flow.initialCash)}*`);
      msg3.push(`💵 Clientes entregarão: *R$ ${formatMoney(changePlan.flow.tenderedCash)}*`);
      msg3.push(`↩️ Troco devolvido em espécie: *R$ ${formatMoney(changePlan.flow.plannedCashChange)}*`);
      if (changePlan.flow.plannedPixChange > 0) {
        msg3.push(`📱 Troco devolvido via Pix: *R$ ${formatMoney(changePlan.flow.plannedPixChange)}*`);
      }
      msg3.push(`🏁 *Deve voltar fisicamente na bag: R$ ${formatMoney(changePlan.flow.expectedPhysicalReturn)}*`);
    }

    // R288: apenas pendencias no segundo envio. Identidade iFood permanece individual.
    const compactChecklist: string[] = [];
    compactChecklist.push(`🏍️ *Rota ${routeNumber} · ${route.motoboy_name}*`);
    compactChecklist.push(`📦 ${totalDeliveries} pedidos · ${totalStops} paradas`);
    compactChecklist.push('✅ *ANTES DE SAIR · AÇÕES PENDENTES*');
    let compactTasks = 0;
    const drinkRows = Object.values(drinksSummary);
    if (drinkRows.length) {
      compactChecklist.push('🥤 *PEGAR BEBIDAS*');
      drinkRows.forEach(item => compactChecklist.push(`  • *${item.qty}× ${item.name}*`));
      compactTasks++;
    }
    const compactStops = groupDeliveriesByStop(deliveries);
    const customerFor = (item: Delivery) => getCustomerById(item.customer_id)?.name || item.customer_name || 'Cliente';
    const pendingCardOrders = deliveries.filter(item => !deliveryPaid(item) && (deliverySplitStatus(item)?.valid ? Boolean(deliverySplitStatus(item)?.cardCents) : item.payment_method?.includes('cartao')));
    const cashChangeOrders = deliveries.filter(item => !deliveryPaid(item) && (deliverySplitStatus(item)?.valid ? Boolean(deliverySplitStatus(item)?.changeCents) : item.payment_method === 'dinheiro' && Number(item.change_for) > deliveryCharge(item)));
    if (pendingCardOrders.length || cashChangeOrders.length) {
      compactChecklist.push('💳 *EQUIPAMENTOS E TROCO*');
      if (pendingCardOrders.length) compactChecklist.push(`  • Levar maquininha · ${pendingCardOrders.length} pedido(s)`);
      if (cashChangeOrders.length) compactChecklist.push(`  • Preparar troco · ${cashChangeOrders.length} pedido(s)`);
      compactTasks++;
    }
    const codesPending = deliveries.filter(item => item.origin === 'ifood' && !orderConfirmationCode(item.confirmation_code));
    if (codesPending.length) {
      compactChecklist.push('', `🔑 *${codesPending.length} código(s) iFood a solicitar*`);
      compactChecklist.push(driverConfirmsIfood ? 'pedir código e confirmar no portal por cliente:' : 'pedir código aos clientes abaixo:');
      compactStops.forEach((stop, index) => {
        const missing = stop.deliveries.filter(item => item.origin === 'ifood' && !orderConfirmationCode(item.confirmation_code));
        if (!missing.length) return;
        compactChecklist.push(`📍 *Parada ${index+1}${stop.deliveries.length>1?' · pedidos no mesmo endereço':''}*`);
        missing.forEach(item => compactChecklist.push(`  • ${customerFor(item)} · ${item.ifood_id ? `ID ${item.ifood_id}` : item.order_id ? `pedido #${item.order_id}` : 'ID ausente: avisar loja'}`));
      });
      compactTasks++;
    }
    if (driverConfirmsIfood && ifoodCount > 0) {
      compactChecklist.push('🔴 Confirmar individualmente no portal iFood depois de obter o código.');
      compactChecklist.push(IFOOD_DRIVER_CONFIRMATION_URL);
      compactTasks++;
    }
    const pendingPixOrders = deliveries.filter(item => !deliveryPaid(item) && (deliverySplitStatus(item)?.valid ? Boolean(deliverySplitStatus(item)?.pixCents) : item.payment_method === 'pix'));
    const pendingCollections = [...pendingPixOrders, ...pendingCardOrders, ...cashChangeOrders];
    if (pendingCollections.length) {
      compactChecklist.push('', '💰 *COBRANÇAS POR PARADA E CLIENTE*');
      compactStops.forEach((stop, index) => {
        const collected: string[] = [];
        stop.deliveries.forEach(item => {
          if (deliveryPaid(item)) return;
          const split = deliverySplitStatus(item);
          const pix = split?.valid ? split.pixCents/100 : item.payment_method === 'pix' ? deliveryCharge(item) : 0;
          const card = split?.valid ? split.cardCents/100 : item.payment_method?.includes('cartao') ? deliveryCharge(item) : 0;
          const change = split?.valid ? split.changeCents/100 : item.payment_method === 'dinheiro' ? Math.max(0,(Number(item.change_for)||0)-deliveryCharge(item)) : 0;
          const parts = [pix>0?`Pix R$ ${formatMoney(pix)}`:'', card>0?`cartão R$ ${formatMoney(card)}`:'',change>0?`troco R$ ${formatMoney(change)}`:''].filter(Boolean);
          if (parts.length) collected.push(`  • ${customerFor(item)} · ${parts.join(' + ')}`);
        });
        if (collected.length) compactChecklist.push(`📍 *Parada ${index+1}*`, ...collected);
      });
      compactTasks++;
    }
    if (fuzzyDeliveries.length) {
      compactChecklist.push(`⚠️ ${fuzzyDeliveries.length} endereço(s) exigem conferência antes da saída`);
      compactTasks++;
    }
    if (!compactTasks) compactChecklist.push('✅ Sem pendências adicionais. Confira trajeto e pedidos no resumo da rota.');

    // Caixa compacto usa a mesma apuração canônica. Nunca recalcula ou quita saldo.
    const compactMoney: string[] = [`💰 *CAIXA DA ROTA ${routeNumber}*`];
    if (!changePlan.lines.length) {
      compactMoney.push('✅ Nenhum recebimento em dinheiro nesta rota.');
    } else {
      changePlan.lines.forEach(line => {
        const splits = [line.cashChange > 0 ? `espécie R$ ${formatMoney(line.cashChange)}` : '', line.pixChange > 0 ? `Pix R$ ${formatMoney(line.pixChange)}` : ''].filter(Boolean);
        compactMoney.push(`${getNumberEmoji(line.stop)} ${line.customer} · cobrar R$ ${formatMoney(line.charge)} · recebe R$ ${formatMoney(line.tendered)}${line.change > 0 ? ` · troco R$ ${formatMoney(line.change)}${splits.length ? ` (${splits.join(' + ')})` : ''}` : ' · sem troco'}`);
      });
      compactMoney.push(`👜 Troco inicial: R$ ${formatMoney(changePlan.flow.initialCash)}`);
      compactMoney.push(`↩️ Troco em espécie: R$ ${formatMoney(changePlan.flow.plannedCashChange)}${changePlan.flow.plannedPixChange > 0 ? ` · via Pix: R$ ${formatMoney(changePlan.flow.plannedPixChange)}` : ''}`);
      compactMoney.push(`🏁 *Retorno físico esperado na bag: R$ ${formatMoney(changePlan.flow.expectedPhysicalReturn)}*`);
    }

    return {
      success: true,
      hasFuzzyAddresses,
      fuzzyList: fuzzyDeliveries,
      messages: [msg1.join('\n'), (messageDetailMode === 'guided' ? msg2 : compactChecklist).join('\n'), (messageDetailMode === 'guided' ? msg3 : compactMoney).join('\n')]
    };
  } catch (error) {
    console.error('Falha ao gerar mensagens da rota:', error);
    return { success: false, hasFuzzyAddresses: false, fuzzyList: [], messages: [] };
  }
}
