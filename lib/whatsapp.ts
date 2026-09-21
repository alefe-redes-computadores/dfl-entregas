
import type { Delivery, Route, Customer } from '@/types';
import { resolveStopLocation, buildGoogleMapsRouteUrl, cleanAddressForMaps } from '@/lib/maps';
import { routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { canonicalizeOperationalAddress, bestOperationalAddress, hasHouseNumber } from "@/lib/operational-address";
import { deliveryStopKey, stopNumberMap, groupDeliveriesByStop } from '@/lib/route-stops';

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

export async function copyDeliveryToClipboard(
  delivery: Delivery,
  customerName?: string,
  savedCustomerCode?: string
): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood';
    const valueStr = formatMoney(deliveryCharge(delivery));
    const isUrgent = delivery.is_urgent;
    const currentCode = delivery.confirmation_code || savedCustomerCode;
    const clientPhone = delivery.phone?.replace(/\D/g, '');

    parts.push(`📦 *ENTREGA*`);
    if (isUrgent) parts.push(`🚨 *ATENÇÃO: ENTREGA URGENTE* 🚨`);
    parts.push('');

    if (customerName) parts.push(`👤 *Cliente:* ${customerName}`);

    if (isIfood) {
      let ifoodInfo = `🛒 *Origem:* iFood`;
      if (delivery.order_id) ifoodInfo += ` #${delivery.order_id}`;
      if (delivery.ifood_id) ifoodInfo += ` · ID ${delivery.ifood_id}`;
      parts.push(ifoodInfo);

      if (currentCode) {
        parts.push(`🔑 *Código iFood:* \`${currentCode}\` ✅`);
      } else {
        parts.push(`🚨 *PEGAR O CÓDIGO DE 4 DÍGITOS COM O CLIENTE!*`);
      }
    } else {
      parts.push(`🛒 *Origem:* ${getOriginLabel(delivery)}`);
    }

    const individualAddress = routeAddressParts(delivery.address_string);
    parts.push(`📍 *Destino:* ${individualAddress.neighborhood} · ${individualAddress.streetWithNumber}`);
    if (delivery.observation) parts.push(`⚠️ *ATENÇÃO:* ${delivery.observation}`);

    if (clientPhone && delivery.notify_whatsapp) {
      const gateMsg = encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.');
      parts.push(`📲 *Chamar no portão:* https://wa.me/55${clientPhone}?text=${gateMsg}`);
    }

    if (delivery.is_paid) {
      parts.push(isIfood ? `📱 *Pagamento:* Pago no app ✅` : `📱 *Pagamento:* PIX confirmado ✅`);
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
        parts.push(`⚠️ *Cobrar na maquininha*`);
      } else {
        parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr}`);
      }
    }

    if (delivery.drinks) parts.push(`🥤 *Bebida:* ${delivery.drinks.trim()}`);
    parts.push('');

    if (delivery.maps_link) {
      parts.push(`🗺️ *Mapa:*`); parts.push(delivery.maps_link);
    } else {
      const cleanAddress = cleanAddressForMaps(delivery.address_string);
      parts.push(`🗺️ *Mapa:*`); parts.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`);
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
  previousRoute?: Route | null
): Promise<{ success: boolean; hasFuzzyAddresses: boolean; fuzzyList: any[]; messages: string[] }> {
  try {
    let hasFuzzyAddresses = false;
    const fuzzyDeliveries: any[] = [];

    const msg1: string[] = [];
    const msg2: string[] = [];

    const totalDeliveries = deliveries.length;
    const totalStops = new Set(deliveries.map((delivery) => deliveryGroupKey(delivery))).size;
    const physicalStopNumbers = stopNumberMap(deliveries);
    const drinksSummary: Record<string, { qty: number; name: string }> = {};
    const stopsNeedingCode: { num: number; neighborhood: string; street: string }[] = [];
    const stopsNeedingCall: { num: number; name: string }[] = [];
    const stopsNeedingPosMachine: number[] = [];

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
      const clientName = customer?.name || representative.customer_name || 'Cliente';
      const clientPhone = (representative.phone || customer?.phone || '').replace(/\D/g, '');

      if (!hasHouseNumber(street) && !customer?.maps_link) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: representative.id, index: stopNumber, name: clientName, address: representative.address_string, neighborhood });
      }
      routeMapAddresses.push(resolveStopLocation(representative, customer?.maps_link));

      const ifoodOrders = stopGroup.deliveries.filter((item) => item.origin === 'ifood');
      const stopTotal = stopGroup.deliveries.reduce((sum, item) => sum + deliveryCharge(item), 0);
      msg1.push(`*${emojiNum} ${clientName}*`);
      msg1.push(`📍 *${neighborhood}* · ${addressParts.streetWithNumber}`);
      if (stopGroup.deliveries.length > 1) msg1.push(`📦 *${stopGroup.deliveries.length} pedidos nesta parada · Total R$ ${formatMoney(stopTotal)}*`);

      const codes = Array.from(new Set(ifoodOrders.map((item) => item.confirmation_code || customer?.last_confirmation_code || '').map((value) => value.replace(/\D/g, '').slice(0, 4)).filter(Boolean)));
      if (ifoodOrders.length > 0) {
        if (codes.length === 1) msg1.push(`🔑 *Código iFood:* \`${codes[0]}\` ✅`);
        else if (codes.length === 0) { stopsNeedingCode.push({ num: stopNumber, neighborhood, street: streetOnly }); msg1.push(`🚨 *PEGAR CÓDIGO COM O CLIENTE!*`); }
        else msg1.push(`🔑 *Códigos diferentes por pedido:*`);
      }

      stopGroup.deliveries.forEach((item) => {
        const valueStr = formatMoney(deliveryCharge(item));
        const shortId = item.order_id ? `#${item.order_id}` : '#—';
        const idText = item.ifood_id ? ` · ID ${item.ifood_id}` : '';
        const specificCode = (item.confirmation_code || '').replace(/\D/g, '').slice(0, 4);
        let paymentText = '';
        if (item.value === 1) { paymentText='R$ 1,00 · cartão'; stopsNeedingPosMachine.push(stopNumber); }
        else if (item.is_paid) paymentText = item.payment_method === 'pix' ? 'PIX confirmado ✅' : 'Pago no app ✅';
        else if (item.payment_method === 'pix') { paymentText=`R$ ${valueStr} · PIX QR`; stopsNeedingPosMachine.push(stopNumber); }
        else if (item.payment_method?.includes('cartao')) { paymentText=`R$ ${valueStr} · cartão`; stopsNeedingPosMachine.push(stopNumber); }
        else if (item.payment_method === 'dinheiro' && item.change_for) { const troco=Math.max(0,item.change_for-deliveryCharge(item)); paymentText=`R$ ${valueStr} · paga c/ R$ ${formatMoney(item.change_for)} · troco R$ ${formatMoney(troco)}`; }
        else paymentText=`R$ ${valueStr} · ${(item.payment_method || 'dinheiro').toUpperCase()}`;
        const codeText = codes.length > 1 && specificCode ? ` · cód. ${specificCode}` : '';
        msg1.push(`• *${shortId}*${idText} · ${paymentText}${codeText}`);

        if (item.drinks?.trim()) parseDrinkItems(item.drinks.trim()).forEach(({ qty, name }) => { const key=name.toLowerCase(); if(!drinksSummary[key]) drinksSummary[key]={qty:0,name}; drinksSummary[key].qty+=qty; });
      });

      Array.from(new Set(stopGroup.deliveries.map((item) => item.observation?.trim()).filter(Boolean))).forEach((observation) => msg1.push(`⚠️ *ATENÇÃO:* ${observation}`));

      if (clientPhone && stopGroup.deliveries.some((item) => item.notify_whatsapp)) {
        stopsNeedingCall.push({ num: stopNumber, name: clientName });
        const gateMsg=encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.');
        msg1.push(`📲 *Chamar no portão:* https://wa.me/55${clientPhone}?text=${gateMsg}`);
      }
      msg1.push(`──────────────`);
    });

    msg1.push(`🗺️ *ROTA OTIMIZADA:*`);
    msg1.push(`⚠️ *Sequência pronta com as paradas. Clique no link e inicie a rota:*`);
    msg1.push('');

    if (routeMapAddresses.length > 0) {
      const mapUrl = buildGoogleMapsRouteUrl(storeAddress, routeMapAddresses);
      msg1.push(mapUrl);
      msg1.push('');
    }

    if (fuzzyDeliveries.length > 0) {
      msg1.push(`*(🚨 Nota: ${fuzzyDeliveries.length === 1 ? 'A parada' : 'As paradas'} ${fuzzyDeliveries.map(f => f.index).join(', ')} possuem endereço simplificado).*`);
      msg1.push('');
    }
    msg1.push(`──────────────`);

    // MENSAGEM 2: CONFERÊNCIA DA ROTA — BAG, CÓDIGOS, TROCO E CAIXA
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}m`;

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
      const groupedDeliveries = deliveries.filter(
        (candidate) => deliveryGroupKey(candidate) === groupKey,
      );
      const customer = getCustomerById(delivery.customer_id);
      const addressParts = routeAddressParts(
        delivery.address_string,
        customer?.address,
        customer?.neighborhood,
      );
      const neighborhood = addressParts.neighborhood;
      const isDuplicate = neighborhoodCounts[neighborhood] > 1;
      const clientPhone = delivery.phone || customer?.phone;

      const streetLabel = isDuplicate ? ` (${addressParts.street})` : '';
      const groupDrinks = groupedDeliveries
        .map((candidate) => candidate.drinks?.trim())
        .filter(Boolean)
        .join(' + ');
      const drinkInfo = groupDrinks ? ` · 🥤 ${groupDrinks}` : '';
      const zapWarning = (clientPhone && delivery.notify_whatsapp) ? ` · 📲 chamar` : '';
      const needsCode = groupedDeliveries.some((candidate) => {
        if (candidate.origin !== 'ifood') return false;
        const candidateCustomer = getCustomerById(candidate.customer_id);
        return !(candidate.confirmation_code || candidateCustomer?.last_confirmation_code);
      });
      const needsCashChange = groupedDeliveries.some((candidate) =>
        !candidate.is_paid &&
        candidate.payment_method === 'dinheiro' &&
        Boolean(candidate.change_for && candidate.change_for > deliveryCharge(candidate))
      );
      const flags = `${needsCode ? ' · 🔑 código' : ''}${needsCashChange ? ' · 💵 troco' : ''}`;

      msg2.push(`${getNumberEmoji(num)} *${neighborhood}*${streetLabel}${drinkInfo}${flags}${zapWarning}`);
    });

    msg2.push(`──────────────`);

    const drinkKeys = Object.keys(drinksSummary);
    if (drinkKeys.length > 0) {
      msg2.push(`🥤 *Bebidas da bag*`);
      msg2.push(`Conferir antes de sair:`);
      msg2.push('');
      drinkKeys.forEach(key => {
        msg2.push(`• *${drinksSummary[key].qty}x ${drinksSummary[key].name}*`);
      });
      msg2.push(`──────────────`);
    }

    msg2.push(`💳 *MAQUININHA*`);
    if (stopsNeedingPosMachine.length > 0) {
      msg2.push(`⚠️ *Levar maquininha*`);
      msg2.push(`Cobrança nas paradas: ${stopsNeedingPosMachine.map(getNumberEmoji).join(', ')}`);
    } else {
      msg2.push(`Não precisa levar nesta rota.`);
    }
    msg2.push(`──────────────`);

    // LISTA ORGANIZADA DE CÓDIGOS NO FINAL
    if (stopsNeedingCode.length > 0) {
      msg2.push(`🔐 *Códigos iFood*`);
      msg2.push(`Pegar com o cliente:`);
      stopsNeedingCode.forEach((stop) => {
        const duplicateNeighborhood = neighborhoodCounts[stop.neighborhood] > 1;
        msg2.push(`• ${stop.num}. *${stop.neighborhood}*${duplicateNeighborhood ? ` (${stop.street})` : ''}`);
      });
      msg2.push(`──────────────`);
    }

    if (stopsNeedingCall.length > 0) {
      msg2.push(`📲 *Chamar no portão*`);
      stopsNeedingCall.forEach(s => {
        msg2.push(`• Parada ${s.num} (${s.name}): Toque no link da Msg 1 para abrir a conversa!`);
      });
      msg2.push(`──────────────`);
    }

    // V42 — FLUXO FÍSICO DE DINHEIRO.
    // change_for = quanto o cliente pretende entregar (dado do pedido).
    // route.change_money = dinheiro físico que SAIU do caixa e foi para a bag.
    // Portanto, o esperado fisicamente na volta é:
    // troco que saiu do caixa + soma das vendas em dinheiro.
    const pendingMoney = deliveries.filter(
      d => !d.is_paid && d.payment_method === 'dinheiro'
    );
    const cashSalesTotal = pendingMoney.reduce(
      (sum, d) => sum + deliveryCharge(d),
      0,
    );
    const changeMoneyOut = Math.max(0, Number(route.change_money || 0));
    const expectedCashInBag = changeMoneyOut + cashSalesTotal;
    const cashGeneratedForStore = cashSalesTotal;

    if (changeMoneyOut > 0) {
      msg2.push(`🪙 *TROCO (SAI DO CAIXA)*`);
      const changeNeeds = pendingMoney.filter(
        d => d.change_for && d.change_for > deliveryCharge(d)
      );
      changeNeeds.forEach((d) => {
        const num = physicalStopNumbers.get(deliveryGroupKey(d)) || 1;
        const customer = getCustomerById(d.customer_id);
        const needed = Math.max(0, Number(d.change_for || 0) - deliveryCharge(d));
        msg2.push(`• ${getNumberEmoji(num)} ${customer?.name || d.customer_name || 'Cliente'} · precisa R$ ${formatMoney(needed)}`);
      });
      msg2.push(`*Total de troco na bag:* \`R$ ${formatMoney(changeMoneyOut)}\``);
      msg2.push(`──────────────`);
    }

    if (pendingMoney.length > 0 || changeMoneyOut > 0) {
      msg2.push(`💵 *DINHEIRO PRA ENTREGAR NO CAIXA*`);
      pendingMoney.forEach((d) => {
        const num = physicalStopNumbers.get(deliveryGroupKey(d)) || 1;
        const customer = getCustomerById(d.customer_id);
        msg2.push(`• ${getNumberEmoji(num)} ${customer?.name || d.customer_name || 'Cliente'} · venda R$ ${formatMoney(deliveryCharge(d))}`);
      });
      if (changeMoneyOut > 0) {
        msg2.push(`Troco inicial da bag: R$ ${formatMoney(changeMoneyOut)}`);
      }
      msg2.push(`*Esperado fisicamente na bag:* \`R$ ${formatMoney(expectedCashInBag)}\``);
      msg2.push(`*Venda em dinheiro gerada para o caixa:* \`R$ ${formatMoney(cashGeneratedForStore)}\``);
      msg2.push(`──────────────`);
    }

    return {
      success: true,
      hasFuzzyAddresses,
      fuzzyList: fuzzyDeliveries,
      messages: [msg1.join('\n'), msg2.join('\n')]
    };
  } catch (error) {
    console.error('Falha ao gerar mensagens da rota:', error);
    return { success: false, hasFuzzyAddresses: false, fuzzyList: [], messages: [] };
  }
}