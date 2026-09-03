import type { Delivery, Route, Customer } from '@/types';
import { resolveStopLocation, buildGoogleMapsRouteUrl, cleanAddressForMaps } from '@/lib/maps';

export async function copyDeliveryToClipboard(
  delivery: Delivery,
  customerName?: string,
  savedCustomerCode?: string
): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood' || !delivery.origin;
    const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';
    const isUrgent = delivery.is_urgent;
    const currentCode = delivery.confirmation_code || savedCustomerCode;
    const clientPhone = delivery.phone?.replace(/\D/g, '');

    parts.push(`📦 *DADOS DA ENTREGA* 📦`);
    if (isUrgent) parts.push(`🚨 *ATENÇÃO: ENTREGA URGENTE* 🚨`);
    parts.push('');

    if (customerName) parts.push(`👤 *Cliente:* ${customerName}`);

    if (isIfood) {
      let ifoodInfo = `🛒 *Origem:* iFood`;
      if (delivery.order_id) ifoodInfo += ` (#${delivery.order_id})`;
      if (delivery.ifood_id) ifoodInfo += ` - ID: ${delivery.ifood_id}`;
      parts.push(ifoodInfo);

      if (currentCode) {
        parts.push(`🔑 *Código Salvo:* ${currentCode} ✅`);
      } else {
        parts.push(`🚨 *ATENÇÃO: PEGAR CÓDIGO DE 4 DÍGITOS COM O CLIENTE!*`);
      }
    } else {
      parts.push(`🛒 *Origem:* Loja Própria`);
    }

    parts.push(`🏠 *Endereço:* ${delivery.address_string}`);
    if (delivery.observation) parts.push(`⚠️ *OBS:* ${delivery.observation}`);

    if (clientPhone && delivery.notify_whatsapp) {
      const gateMsg = encodeURIComponent('Olá! Sou o entregador da Da Família Lanches, cheguei no portão com seu pedido!');
      parts.push(`📲 *Chamar no Portão:* https://wa.me/55${clientPhone}?text=${gateMsg}`);
    }

    if (delivery.is_paid) {
      parts.push(`📱 *Pagamento:* Pago no App ✅`);
    } else {
      const pMethod = delivery.payment_method?.toUpperCase().replace('_', ' ') || 'PAGAMENTO';
      if (delivery.payment_method === 'dinheiro') {
        if (delivery.change_for) {
          const troco = delivery.change_for - (delivery.value || 0);
          parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr} (Cliente paga com R$ ${delivery.change_for.toFixed(2).replace('.', ',')} | Troco: R$ ${troco.toFixed(2).replace('.', ',')})`);
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
  const start = new Date(startTimeStr).getTime();
  const end = new Date(endTimeStr).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return null;

  const diffMinutes = Math.round((end - start) / 60000);
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
    const stopsNeedingCode: number[] = [];
    const stopsNeedingCall: { num: number; name: string }[] = [];
    const stopsNeedingPosMachine: number[] = [];

    msg1.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    const matchRouteNumber = route.name.match(/\d+/);
    const routeNumber = matchRouteNumber ? parseInt(matchRouteNumber[0], 10) : 1;
    
    msg1.push(`🏍️ *ROTA ${getNumberEmoji(routeNumber)} - ${route.motoboy_name.toUpperCase()}* *(${totalDeliveries} Entregas)*`);
    msg1.push('');
    msg1.push(`📦 *RESUMO DAS PARADAS:*`);
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
      const street = delivery.address_string.split(',')[0].trim();
      const shortId = delivery.order_id ? `#${delivery.order_id}` : '';
      const isIfood = delivery.origin === 'ifood' || !delivery.origin;
      const existingCode = delivery.confirmation_code || customer?.last_confirmation_code;
      const clientPhone = (delivery.phone || customer?.phone || '').replace(/\D/g, '');
      
      const hasNumber = /\d/.test(delivery.address_string);
      const isFuzzy = !hasNumber && !customer?.maps_link;
      
      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: delivery.id, index: num, name: customer?.name || 'Cliente', address: delivery.address_string, neighborhood });
      }

      const stopLocation = resolveStopLocation(delivery, customer?.maps_link);
      routeMapAddresses.push(stopLocation);

      const clientName = customer?.name || 'Cliente';
      msg1.push(`*${emojiNum} ${clientName}* *(IFOOD ${shortId})*`);
      
      if (delivery.ifood_id) {
        msg1.push(`*ID: [${delivery.ifood_id}]*`);
      }

      if (isIfood) {
        if (existingCode) {
          msg1.push(`🔑 *Cód. iFood Salvo:* \`${existingCode}\` ✅`);
        } else {
          stopsNeedingCode.push(num);
          msg1.push(`🚨 *PEGAR CÓDIGO DO IFOOD NA PORTA!*`);
        }
      }

      msg1.push(`🏠 Endereço: ${street}`);
      msg1.push(`- Bairro: \`${neighborhood}\``);
      
      if (delivery.observation) {
        msg1.push(`⚠️ *OBS:* ${delivery.observation}`);
      }

      if (clientPhone && delivery.notify_whatsapp) {
        stopsNeedingCall.push({ num, name: clientName });
        const gateMsg = encodeURIComponent('Olá! Sou o entregador da Da Família Lanches, cheguei no portão com seu pedido!');
        msg1.push(`📲 *Chamar no Portão:* https://wa.me/55${clientPhone}?text=${gateMsg}`);
      }

      const valueStr = (delivery.value || 0).toFixed(2).replace('.', ',');

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
          const troco = delivery.change_for - (delivery.value || 0);
          msg1.push(`- 💵 *Pagamento:* R$ ${valueStr} *(Paga c/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')} | Troco: R$ ${troco.toFixed(2).replace('.', ',')})*`);
        } else {
          msg1.push(`- 💵 *Pagamento:* *R$ ${valueStr} (${delivery.payment_method?.toUpperCase() || 'DINHEIRO'})*`);
        }
      }

      if (delivery.drinks) {
        const rawDrinkStr = delivery.drinks.trim();
        msg1.push(`- 🥤 *Bebida:* ${rawDrinkStr}`);
        const match = rawDrinkStr.match(/^(\d+)\s+(.+)$/);
        let qty = 1; 
        let drinkName = rawDrinkStr;
        if (match) { 
          qty = parseInt(match[1], 10); 
          drinkName = match[2].trim(); 
        }
        const key = drinkName.toLowerCase();
        if (!drinksSummary[key]) drinksSummary[key] = { qty: 0, name: drinkName };
        drinksSummary[key].qty += qty;
      }
      
      msg1.push(`━━━━━━━━━━━━━━━━━━━━━━`);
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
    msg1.push(`━━━━━━━━━━━━━━━━━━━━━━`);

    // MENSAGEM 2: ACERTO FINANCEIRO, BAG E RECOLHIMENTO
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}m`;

    msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    msg2.push(`*ROTA ${getNumberEmoji(routeNumber)}:* ${getNumberEmoji(totalDeliveries)} *ENTREGAS*`);
    msg2.push(`*SAÍDA:* \`${timeString}\``);

    if (previousRoute) {
      const prevDuration = formatDuration(
        (previousRoute as any).started_at || (previousRoute as any).created_at,
        (previousRoute as any).finished_at || (previousRoute as any).completed_at
      );
      if (prevDuration) {
        const matchPrev = previousRoute.name.match(/\d+/);
        const prevNum = matchPrev ? matchPrev[0] : 'anterior';
        msg2.push(`⏱️ *TEMPO ROTA ${prevNum}:* \`${prevDuration}\``);
      }
    }

    msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    msg2.push(`*CONFERÊNCIA DE SAÍDA:*`);
    msg2.push('');

    deliveries.forEach((delivery, index) => {
      const num = index + 1;
      const customer = getCustomerById(delivery.customer_id);
      const neighborhood = customer?.neighborhood || delivery.address_string.split('-').pop()?.trim() || 'Bairro';
      const street = delivery.address_string.split(',')[0].trim();
      const isDuplicate = neighborhoodCounts[neighborhood] > 1;
      const isIfood = delivery.origin === 'ifood' || !delivery.origin;
      const existingCode = delivery.confirmation_code || customer?.last_confirmation_code;
      const clientPhone = delivery.phone || customer?.phone;
      
      const streetLabel = isDuplicate ? ` (${street})` : '';
      const drinkInfo = delivery.drinks && delivery.drinks.trim() !== '' ? ` — 🥤 *(${delivery.drinks.trim()})*` : '';
      const codeWarning = (isIfood && !existingCode) ? ` 🚨 *[CÓDIGO]*` : '';
      const zapWarning = (clientPhone && delivery.notify_whatsapp) ? ` 📲 *[ZAP]*` : '';
      
      msg2.push(`${num}. ${neighborhood}${streetLabel}${drinkInfo}${codeWarning}${zapWarning}`);
    });

    msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    
    const drinkKeys = Object.keys(drinksSummary);
    if (drinkKeys.length > 0) {
      msg2.push(`🥤 *RESUMO DE BEBIDAS (BAG):*`);
      msg2.push(`⚠️ *Conferir itens antes de sair da loja:*`);
      msg2.push('');
      drinkKeys.forEach(key => {
        msg2.push(`• *${drinksSummary[key].qty}x ${drinksSummary[key].name}*`);
      });
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    }

    if (stopsNeedingPosMachine.length > 0) {
      msg2.push(`💳 *LEVAR MAQUININHA DE CARTÃO!*`);
      msg2.push(`⚠️ *Cobrança nas paradas: ${stopsNeedingPosMachine.join(', ')}*`);
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    }

    if (stopsNeedingCode.length > 0) {
      msg2.push(`🔐 *CÓDIGOS IFOOD (PEGAR NA PORTA):*`);
      msg2.push(`⚠️ *Atenção nas paradas: ${stopsNeedingCode.join(', ')}*`);
      msg2.push(`↳ *Pedir os 4 dígitos antes de entregar!*`);
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    }

    if (stopsNeedingCall.length > 0) {
      msg2.push(`📲 *CHAMAR NO PORTÃO VIA ZAP:*`);
      stopsNeedingCall.forEach(s => {
        msg2.push(`• Parada ${s.num} (${s.name}): Toque no link da Msg 1 para abrir a conversa!`);
      });
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    }

    // CÁLCULO EXATO DO DINHEIRO RECOLHIDO
    const pendingMoney = deliveries.filter(d => !d.is_paid && d.payment_method === 'dinheiro');
    if (pendingMoney.length > 0) {
      msg2.push(`💵 *DINHEIRO A RECOLHER (ENTREGAR NO CAIXA):*`);
      msg2.push('');
      let totalDinheiroAReceber = 0;

      pendingMoney.forEach((d) => {
        const num = deliveries.findIndex(x => x.id === d.id) + 1;
        const pedidoVal = d.value || 0;
        const dinheiroEmMaos = d.change_for ? d.change_for : pedidoVal;
        totalDinheiroAReceber += dinheiroEmMaos;
        
        if (d.change_for) {
          const troco = d.change_for - pedidoVal;
          msg2.push(`- Parada ${num}: \`R$ ${dinheiroEmMaos.toFixed(2).replace('.', ',')}\` *(Pedido R$ ${pedidoVal.toFixed(2).replace('.', ',')} | Levou R$ ${troco.toFixed(2).replace('.', ',')} de troco)*`);
        } else {
          msg2.push(`- Parada ${num}: \`R$ ${dinheiroEmMaos.toFixed(2).replace('.', ',')}\` *(Valor exato do pedido)*`);
        }
      });

      msg2.push('');
      msg2.push(`● *TOTAL A PASSAR PRO CAIXA:* \`R$ ${totalDinheiroAReceber.toFixed(2).replace('.', ',')}\``);
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
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
