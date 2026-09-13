
import type { Delivery, Route, Customer } from '@/types';
import { resolveStopLocation, buildGoogleMapsRouteUrl, cleanAddressForMaps } from '@/lib/maps';
import { routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { bestOperationalAddress, hasHouseNumber } from "@/lib/operational-address";

const formatMoney = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    const valueStr = formatMoney(delivery.value || 0);
    const isUrgent = delivery.is_urgent;
    const currentCode = delivery.confirmation_code || savedCustomerCode;
    const clientPhone = delivery.phone?.replace(/\D/g, '');

    parts.push(`📦 *Entrega*`);
    if (isUrgent) parts.push(`🚨 *ATENÇÃO: ENTREGA URGENTE* 🚨`);
    parts.push('');

    if (customerName) parts.push(`👤 *Cliente:* ${customerName}`);

    if (isIfood) {
      let ifoodInfo = `🛒 *Origem:* iFood`;
      if (delivery.order_id) ifoodInfo += ` (#${delivery.order_id})`;
      if (delivery.ifood_id) ifoodInfo += ` - ID: ${delivery.ifood_id}`;
      parts.push(ifoodInfo);

      if (currentCode) {
        parts.push(`🔑 *Código iFood:* ${currentCode} ✅`);
      } else {
        parts.push(`🚨 *ATENÇÃO: PEGAR CÓDIGO DE 4 DÍGITOS COM O CLIENTE!*`);
      }
    } else {
      parts.push(`🛒 *Origem:* ${getOriginLabel(delivery)}`);
    }

    parts.push(`🏠 *Endereço:* ${delivery.address_string}`);
    if (delivery.observation) parts.push(`⚠️ *Observação:* ${delivery.observation}`);

    if (clientPhone && delivery.notify_whatsapp) {
      const gateMsg = encodeURIComponent('Olá! Sou o entregador da Da Família Lanches, cheguei no portão com seu pedido!');
      parts.push(`📲 *Chamar no portão:* https://wa.me/55${clientPhone}?text=${gateMsg}`);
    }

    if (delivery.is_paid) {
      parts.push(`📱 *Pagamento:* Pago no App ✅`);
    } else {
      const pMethod = delivery.payment_method?.toUpperCase().replace('_', ' ') || 'PAGAMENTO';
      if (delivery.payment_method === 'dinheiro') {
        if (delivery.change_for) {
          const troco = Math.max(0, delivery.change_for - (delivery.value || 0));
          parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr} (Cliente paga com R$ ${formatMoney(delivery.change_for)} | Troco: R$ ${formatMoney(troco)})`);
        } else {
          parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr} (Valor exato)`);
        }
      } else if (delivery.payment_method?.includes('cartao') || (delivery.payment_method as string) === 'cartao') {
        parts.push(`💳 *Pagamento:* CARTÃO - R$ ${valueStr} (Levar maquininha)`);
      } else if (delivery.payment_method === 'pix') {
        parts.push(`💠 *Pagamento:* PIX QR Code - R$ ${valueStr} (Na maquininha)`);
      } else {
        parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr}`);
      }
    }

    if (delivery.drinks) parts.push(`🥤 *Bebida:* ${delivery.drinks.trim()}`);
    parts.push('');

    if (delivery.maps_link) {
      parts.push(`🗺️ *Mapa:* ${delivery.maps_link}`);
    } else {
      const cleanAddress = cleanAddressForMaps(delivery.address_string);
      parts.push(`🗺️ *Mapa:* https://maps.google.com/?q=${encodeURIComponent(cleanAddress)}`);
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
    const drinksSummary: Record<string, { qty: number; name: string }> = {};
    const stopsNeedingCode: { num: number; neighborhood: string; street: string }[] = [];
    const stopsNeedingCall: { num: number; name: string }[] = [];
    const stopsNeedingPosMachine: number[] = [];

    msg1.push(`──────────────`);
    const matchRouteNumber = route.name.match(/\d+/);
    const routeNumber = matchRouteNumber ? parseInt(matchRouteNumber[0], 10) : 1;

    msg1.push(`🏍️ *Rota ${routeNumber} · ${route.motoboy_name}*`);
    msg1.push(`📦 *${totalDeliveries} ${totalDeliveries === 1 ? 'entrega' : 'entregas'}*`);

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
    msg1.push(`📍 *PARADAS*`);
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

    const neighborhoodCounts = deliveries.reduce((acc: Record<string, number>, d) => {
      const cust = getCustomerById(d.customer_id);
      const nb = cust?.neighborhood || d.address_string.split('-').pop()?.trim() || 'Bairro';
      acc[nb] = (acc[nb] || 0) + 1;
      return acc;
    }, {});

    deliveries.forEach((delivery, index) => {
      const num = index + 1;
      const emojiNum = getNumberEmoji(num);
      const customer = getCustomerById(delivery.customer_id);
      const neighborhood = customer?.neighborhood || delivery.address_string.split('-').pop()?.trim() || 'Bairro não inf.';
      const street = bestOperationalAddress(delivery.address_string, customer?.address) || "Endereço não informado";
      const shortId = delivery.order_id ? `#${delivery.order_id}` : '';
      const isIfood = delivery.origin === 'ifood';
      const originLabel = getOriginLabel(delivery);
      const stopOriginLabel = isIfood
        ? `IFOOD${shortId ? ` ${shortId}` : ''}`
        : delivery.origin === 'loja'
          ? `LOJA${shortId ? ` ${shortId}` : ''}`
          : `ORIGEM NÃO REGISTRADA${shortId ? ` ${shortId}` : ''}`;
      const existingCode = delivery.confirmation_code || customer?.last_confirmation_code;
      const clientPhone = (delivery.phone || customer?.phone || '').replace(/\D/g, '');

      const hasNumber = hasHouseNumber(street);
      const isFuzzy = !hasNumber && !customer?.maps_link;

      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: delivery.id, index: num, name: customer?.name || 'Cliente', address: delivery.address_string, neighborhood });
      }

      const stopLocation = resolveStopLocation(delivery, customer?.maps_link);
      routeMapAddresses.push(stopLocation);

      const clientName = customer?.name || 'Cliente';
      msg1.push(`*${emojiNum} ${clientName}* *(${stopOriginLabel})*`);

      if (delivery.ifood_id) {
        msg1.push(`*ID: [${delivery.ifood_id}]*`);
      }
      if (!isIfood && delivery.origin !== 'loja') {
        msg1.push(`⚠️ *Origem:* ${originLabel}`);
      }

      if (isIfood) {
        if (existingCode) {
          msg1.push(`🔑 *Cód. iFood Salvo:* \`${existingCode}\` ✅`);
        } else {
          // Salva para a lista do final
          stopsNeedingCode.push({ num, neighborhood, street });
        }
      }

      msg1.push(`🏠 Endereço: ${street}`);
      msg1.push(`- Bairro: \`${neighborhood}\``);

      if (delivery.observation) {
        msg1.push(`⚠️ *Observação:* ${delivery.observation}`);
      }

      if (clientPhone && delivery.notify_whatsapp) {
        stopsNeedingCall.push({ num, name: clientName });
        const gateMsg = encodeURIComponent('Olá! Sou o entregador da Da Família Lanches, cheguei no portão com seu pedido!');
        msg1.push(`📲 *Chamar no portão:* https://wa.me/55${clientPhone}?text=${gateMsg}`);
      }

      const valueStr = formatMoney(delivery.value || 0);

      if (delivery.value === 1) {
        msg1.push(`- 💵 *Pagamento:* R$ 1,00 (Cartão)`);
        msg1.push(`- ⚠️ *UM REAL mesmo* (pedido proporcional)`);
        stopsNeedingPosMachine.push(num);
      } else if (delivery.is_paid) {
        if (delivery.payment_method === 'pix') {
          msg1.push(`- 📱 *Pagamento:* PIX Confirmado ✅`);
        } else {
          msg1.push(`- 📱 *Pagamento:* Pago ✅`);
        }
      } else {
        if (delivery.payment_method === 'pix') {
          msg1.push(`- 📱 *Pagamento:* *R$ ${valueStr} (PIX QR)*`);
          msg1.push(`- ❌ *Ainda não pagou, cobrar na maquininha!*`);
          stopsNeedingPosMachine.push(num);
        } else if (delivery.payment_method?.includes('cartao')) {
          msg1.push(`- 💳 *Pagamento:* *R$ ${valueStr} (CARTÃO)*`);
          stopsNeedingPosMachine.push(num);
        } else if (delivery.payment_method === 'dinheiro' && delivery.change_for) {
          const troco = Math.max(0, delivery.change_for - (delivery.value || 0));
          msg1.push(`- 💵 *Pagamento:* R$ ${valueStr} *(Paga c/ R$ ${formatMoney(delivery.change_for)} | Troco: R$ ${formatMoney(troco)})*`);
        } else {
          msg1.push(`- 💵 *Pagamento:* *R$ ${valueStr} (${delivery.payment_method?.toUpperCase() || 'DINHEIRO'})*`);
        }
      }

      if (delivery.drinks?.trim()) {
        const rawDrinkStr = delivery.drinks.trim();
        msg1.push(`- 🥤 *Bebida:* ${rawDrinkStr}`);

        parseDrinkItems(rawDrinkStr).forEach(({ qty, name }) => {
          const key = name.toLowerCase();
          if (!drinksSummary[key]) drinksSummary[key] = { qty: 0, name };
          drinksSummary[key].qty += qty;
        });
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

    // MENSAGEM 2: ACERTO FINANCEIRO, BAG E RECOLHIMENTO
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}m`;

    msg2.push(`──────────────`);
    msg2.push(`🏍️ *Rota ${routeNumber} · ${route.motoboy_name}*`);
    msg2.push(`📦 ${totalDeliveries} ${totalDeliveries === 1 ? 'entrega' : 'entregas'} · saída *${timeString}*`);

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
    msg2.push(`*Antes de sair*`);
    msg2.push('');

    deliveries.forEach((delivery, index) => {
      const num = index + 1;
      const customer = getCustomerById(delivery.customer_id);
      const neighborhood = customer?.neighborhood || delivery.address_string.split('-').pop()?.trim() || 'Bairro';
      const street = bestOperationalAddress(delivery.address_string, customer?.address) || "Endereço não informado";
      const isDuplicate = neighborhoodCounts[neighborhood] > 1;
      const clientPhone = delivery.phone || customer?.phone;

      const streetLabel = isDuplicate ? ` (${street})` : '';
      const drinkInfo = delivery.drinks?.trim() ? ` — 🥤 *(${delivery.drinks.trim()})*` : '';
      const zapWarning = (clientPhone && delivery.notify_whatsapp) ? ` 📲 *[ZAP]*` : '';

      // Removemos o aviso sujo de [CÓDIGO] daqui para deixar a lista limpa
      msg2.push(`${num}. *${neighborhood}*${streetLabel}${drinkInfo}${zapWarning}`);
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

    if (stopsNeedingPosMachine.length > 0) {
      msg2.push(`💳 *Levar maquininha*`);
      msg2.push(`⚠️ *Cobrança nas paradas: ${stopsNeedingPosMachine.join(', ')}*`);
      msg2.push(`──────────────`);
    }

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

    // CÁLCULO EXATO DO DINHEIRO RECOLHIDO
    const pendingMoney = deliveries.filter(d => !d.is_paid && d.payment_method === 'dinheiro');
    if (pendingMoney.length > 0) {
      msg2.push(`💵 *Dinheiro para o caixa*`);
      msg2.push('');
      let totalDinheiroAReceber = 0;

      pendingMoney.forEach((d) => {
        const num = deliveries.findIndex(x => x.id === d.id) + 1;
        const pedidoVal = d.value || 0;
        const dinheiroEmMaos = d.change_for ? d.change_for : pedidoVal;
        totalDinheiroAReceber += dinheiroEmMaos;

        if (d.change_for) {
          const troco = d.change_for - pedidoVal;
          msg2.push(`- Parada ${num}: \`R$ ${formatMoney(dinheiroEmMaos)}\` *(Pedido R$ ${formatMoney(pedidoVal)} | Levou R$ ${formatMoney(troco)} de troco)*`);
        } else {
          msg2.push(`- Parada ${num}: \`R$ ${formatMoney(dinheiroEmMaos)}\` *(Valor exato do pedido)*`);
        }
      });

      msg2.push('');
      msg2.push(`*Total para o caixa:* \`R$ ${formatMoney(totalDinheiroAReceber)}\``);
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