
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

type ParsedDrinkItem = {
  qty: number;
  name: string;
};

const parseDrinkItems = (raw?: string): ParsedDrinkItem[] => {
  if (!raw?.trim()) return [];

  return raw
    .split(/\s*(?:,|;|\+|\n)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(?:(\d+)\s*[xX]?\s+|([0-9]+)[xX]\s*)(.+)$/);
      if (!match) return { qty: 1, name: part };

      const qty = Number(match[1] || match[2] || 1);
      const name = (match[3] || part).trim();

      return {
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        name,
      };
    });
};

const getOriginLabel = (delivery: Delivery): string => {
  if (delivery.origin === 'ifood') return 'iFood';
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

export async function copyDeliveryToClipboard(
  delivery: Delivery,
  customerName?: string,
  savedCustomerCode?: string,
  relatedDeliveries: Delivery[] = [delivery],
  stopPosition?: number,
  ifoodConfirmationMode: 'store' | 'motoboy' = 'store',
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
        const payment = deliveryPaid(item)
          ? 'Pago ✅'
          : itemSplit?.valid
            ? `Cobrar R$ ${formatMoney(deliveryCharge(item))} · dividido (detalhes abaixo)`
            : `Cobrar R$ ${formatMoney(deliveryCharge(item))} · ${(item.payment_method||'dinheiro').replace(/_/g,' ')}`;
        parts.push(`${index + 1}. *${itemName}* · ${itemOrigin} · ${itemReference}`);
        if (item.origin === 'ifood') parts.push(driverConfirmsIfood
          ? itemCode ? `   🔑 Código: *${itemCode}* · confirmar no portal` : '   🚨 *PEDIR O CÓDIGO DE 4 DÍGITOS E CONFIRMAR NO PORTAL*'
          : itemCode ? `   🔑 Código: *${itemCode}*` : '   🚨 *PEDIR O CÓDIGO DE 4 DÍGITOS*');
        if (driverConfirmsIfood && item.origin === 'ifood' && !item.ifood_id) parts.push('   ⚠️ *ID iFood ausente — solicitar à loja*');
        parts.push(`   ${deliveryPaid(item)?'✅':'💵'} ${payment}`);
        if (itemSplit?.valid && !deliveryPaid(item)) {
          if (itemSplit.cashCents) parts.push(`   💵 Dinheiro: R$ ${formatMoney(itemSplit.cashCents / 100)}`);
          if (itemSplit.cardCents) parts.push(`   💳 Cartão: R$ ${formatMoney(itemSplit.cardCents / 100)} · levar maquininha`);
          if (itemSplit.pixCents) parts.push(`   📱 Pix: R$ ${formatMoney(itemSplit.pixCents / 100)} · conferir recebimento`);
          if (itemSplit.changeCents) parts.push(`   🔁 Troco: R$ ${formatMoney(itemSplit.changeCents / 100)}`);
        }
      });
      parts.push('📍 *Uma parada física · entregar cada pedido separadamente*');
      const address = routeAddressParts(delivery.address_string);
      parts.push(`📍 *Destino:* ${address.neighborhood} · ${address.streetWithNumber}`);
      const mapLink=delivery.maps_link||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddressForMaps(delivery.address_string))}`;
      if (driverConfirmsIfood && groupedOrders.some(item => item.origin === 'ifood')) parts.push('', '🗺️ *1. Navegar ate a parada:*');
      parts.push('', '🗺️ *Abrir no mapa:*', mapLink);
      if (driverConfirmsIfood && groupedOrders.some(item => item.origin === 'ifood')) {
        parts.push('', '🔴 *2. Confirmar pedidos iFood no portal:*', IFOOD_DRIVER_CONFIRMATION_URL, 'Solicite o código de 4 dígitos e confirme cada ID iFood separadamente. Abrir o link não confirma a entrega.');
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
        parts.push(driverConfirmsIfood ? `🚨 *PEGAR O CÓDIGO DE 4 DÍGITOS E CONFIRMAR NO PORTAL!*` : `🚨 *PEGAR O CÓDIGO DE 4 DÍGITOS COM O CLIENTE!*`);
      }
      if (driverConfirmsIfood && !delivery.ifood_id) parts.push('⚠️ *ID iFood ausente — pedir à loja antes de confirmar*');
    } else {
      if (delivery.order_id) parts.push(`🧾 *Pedido #${delivery.order_id}*`);
    }

    const individualAddress = routeAddressParts(delivery.address_string);
    parts.push(`📍 *Destino:* ${individualAddress.streetWithNumber} · *${individualAddress.neighborhood}*`);
    if (delivery.observation) parts.push(`⚠️ *ATENÇÃO:* ${delivery.observation}`);

    if (clientPhone) {
      const gateMsg = encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.');
      parts.push(`📲 *Contato:* *${clientPhone}*`);
      if (delivery.notify_whatsapp) parts.push(`↳ https://wa.me/${clientPhone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').replace(/^(?=\d{10,11}$)/, '55')}?text=${gateMsg}`);
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
          parts.push(`💵 *Pagamento:* DINHEIRO · *R$ ${valueStr}*`);
          parts.push(`↳ Cliente paga com R$ ${formatMoney(delivery.change_for)}`);
          parts.push(`↳ 🔁 *Troco: R$ ${formatMoney(troco)}*`);
        } else {
          parts.push(`💵 *Pagamento:* DINHEIRO · *R$ ${valueStr}*`);
        }
      } else if (delivery.payment_method?.includes('cartao') || (delivery.payment_method as string) === 'cartao') {
        parts.push(`💳 *Pagamento:* CARTÃO · *R$ ${valueStr}*`);
        parts.push(`⚠️ *Levar maquininha*`);
      } else if (delivery.payment_method === 'pix') {
        parts.push(`📱 *Pagamento:* PIX · *R$ ${valueStr}*`);
        parts.push(`⚠️ *PIX pendente: confirmar recebimento*`);
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

    if (driverConfirmsIfood && isIfood) parts.push('', '🔴 *Confirmar no iFood:*', IFOOD_DRIVER_CONFIRMATION_URL, 'Informe o ID iFood e o código de 4 dígitos recebido do cliente.');
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
    const ifoodCount = deliveries.filter((delivery) => delivery.origin === 'ifood').length;
    const storeCount = deliveries.filter((delivery) => delivery.origin === 'loja').length;
    const unknownOriginCount = deliveries.length - ifoodCount - storeCount;

    const originSummaryParts: string[] = [];
    if (ifoodCount > 0) originSummaryParts.push(`${ifoodCount} iFood`);
    if (storeCount > 0) originSummaryParts.push(`${storeCount} Loja`);
    if (unknownOriginCount > 0) originSummaryParts.push(`${unknownOriginCount} sem origem`);

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
        if (codes[0]) msg1.push(driverConfirmsIfood ? `🔑 *Código iFood:* *${codes[0]}* · confirmar no portal` : `🔑 *Código iFood:* *${codes[0]}* ✅`);
        else { stopsNeedingCode.push({ num: stopNumber, neighborhood, street: streetOnly, client: firstName(clientName) }); msg1.push(driverConfirmsIfood ? `🚨 *PEGAR CÓDIGO E CONFIRMAR NO PORTAL!*` : `🚨 *PEGAR CÓDIGO COM O CLIENTE!*`); }
      } else if (missingIfoodCode) {
        // Mesmo que outro pedido da mesma parada tenha código válido.
        stopsNeedingCode.push({ num: stopNumber, neighborhood, street: streetOnly, client: firstName(clientName) });
      }

      stopGroup.deliveries.forEach((item) => {
        const itemCustomer = getCustomerById(item.customer_id);
        const itemCustomerName = itemCustomer?.name || item.customer_name || '';
        const valueStr = formatMoney(deliveryCharge(item));
        const reference = item.origin === 'ifood' && item.ifood_id
          ? `ID *${item.ifood_id}*`
          : item.order_id ? `pedido *#${item.order_id}*` : 'sem identificador';
        const specificCode = orderConfirmationCode(item.confirmation_code);
        let paymentText = '';
        if (deliveryPaid(item)) paymentText = 'Pago ✅';
        else if (item.payment_method === 'pix') paymentText=`PIX pendente · R$ ${valueStr}`;
        else if (item.payment_method?.includes('cartao')) { paymentText=`R$ ${valueStr} · cartão`; stopsNeedingPosMachine.push({ num: stopNumber, name: firstName(itemCustomerName || clientName), neighborhood, amount: deliveryCharge(item) }); }
        else if (item.payment_method === 'dinheiro' && item.change_for) { const troco=Math.max(0,item.change_for-deliveryCharge(item)); paymentText=`R$ ${valueStr} · paga c/ R$ ${formatMoney(item.change_for)} · troco R$ ${formatMoney(troco)}`; }
        else paymentText=`R$ ${valueStr} · ${(item.payment_method || 'dinheiro').toUpperCase()}`;
        const customerText = stopGroup.deliveries.length > 1 && itemCustomerName ? `*${itemCustomerName}* · ` : '';
        const codeText = item.origin === 'ifood'
          ? driverConfirmsIfood
            ? specificCode ? ` · 🔑 *${specificCode}* · confirmar no portal` : ' · 🚨 *pedir código e confirmar no portal*'
            : specificCode ? ` · 🔑 *${specificCode}*` : ' · 🚨 *pedir código*'
          : '';
        const paymentAction = ` · ${paymentText}`;
        msg1.push(`• ${customerText}${reference}${codeText}${paymentAction}`);

        if (item.drinks?.trim()) parseDrinkItems(item.drinks.trim()).forEach(({ qty, name }) => { const key=name.toLowerCase(); if(!drinksSummary[key]) drinksSummary[key]={qty:0,name}; drinksSummary[key].qty+=qty; });
      });

      Array.from(new Set(stopGroup.deliveries.map((item) => item.observation?.trim()).filter(Boolean))).forEach((observation) => msg1.push(`⚠️ *ATENÇÃO:* ${observation}`));

      if (clientPhone) {
        stopsNeedingCall.push({ num: stopNumber, name: firstName(clientName), phone: formatOperationalPhone(clientPhone) });
        const gateMsg=encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.');
        msg1.push(`📲 *Contato:* *${formatOperationalPhone(clientPhone)}*`);
        if (stopGroup.deliveries.some((item) => item.notify_whatsapp)) msg1.push(`↳ https://wa.me/55${clientPhone}?text=${gateMsg}`);
      }
      if (driverConfirmsIfood && ifoodOrders.length > 0) {
        msg1.push('🔴 *IDs e códigos acima: confirmação individual no portal ao fim da mensagem.*');
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

    if (driverConfirmsIfood && ifoodCount > 0) {
      msg1.push('🔴 *2. CONFIRMAÇÃO IFOOD*');
      msg1.push(IFOOD_DRIVER_CONFIRMATION_URL);
      msg1.push('Para cada pedido: usar ID iFood de 8 dígitos + código de 4 dígitos do cliente. Abrir o link não conclui o pedido automaticamente.');
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
        msg2.push(`⏱️ *Rota anterior (Rota ${prevNum}):* ${prevDuration}`);
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
          msg2.push('   ↳ 🔴 Confirmar cada ID e código no portal ao fim do checklist.');
        }
        msg2.push('   📍 *1 parada física · pedidos e códigos separados*');
      }else{
        msg2.push(`${getNumberEmoji(num)} *${neighborhood}*${streetLabel}${drinkInfo}${flags}${zapWarning}`);
        const single = groupedDeliveries[0];
        if (driverConfirmsIfood && single?.origin === 'ifood') {
          const code = orderConfirmationCode(single.confirmation_code);
          msg2.push(`   ↳ ID iFood *${single.ifood_id || 'AUSENTE'}* · ${code ? `código *${code}*` : 'pedir código ao cliente'}`);
          msg2.push('   ↳ 🔴 Confirmar pelo portal ao fim do checklist.');
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
      msg2.push('🔴 *CONFIRMAR ENTREGAS IFOOD — RESPONSABILIDADE DO MOTOBOY*');
      msg2.push('Para cada pedido: ID iFood (8 dígitos), código do cliente (4 dígitos) e confirmação individual no portal:');
      msg2.push(IFOOD_DRIVER_CONFIRMATION_URL);
      msg2.push('⚠️ Abrir o portal ou salvar um código no DFL não confirma a entrega.');
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

    // O detalhamento do dinheiro pertence à Mensagem 3.
    // A Mensagem 2 só sinaliza a conferência financeira, sem duplicar valores.
    const cashFlow = routeCashFlow(deliveries, route.change_money);
    if (cashFlow.cashOrders.length > 0 || cashFlow.initialCash > 0) {
      msg2.push(`💰 *Dinheiro da rota:* conferir a Mensagem 3`);
      msg2.push(`──────────────`);
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

    return {
      success: true,
      hasFuzzyAddresses,
      fuzzyList: fuzzyDeliveries,
      messages: [msg1.join('\n'), msg2.join('\n'), msg3.join('\n')]
    };
  } catch (error) {
    console.error('Falha ao gerar mensagens da rota:', error);
    return { success: false, hasFuzzyAddresses: false, fuzzyList: [], messages: [] };
  }
}
