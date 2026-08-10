import type { Delivery, Route, Customer } from '@/types';

// ============================================================================
// 1. COPIAR ENTREGA ÚNICA
// ============================================================================
export async function copyDeliveryToClipboard(
  delivery: Delivery,
  customerName?: string
): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood' || !delivery.origin;
    const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';
    const isUrgent = (delivery as any).is_urgent;

    parts.push(`📦 *DADOS DA ENTREGA* 📦`);
    
    if (isUrgent) {
      parts.push(`🚨 *ATENÇÃO: ENTREGA URGENTE* 🚨`);
    }
    
    parts.push('');

    if (customerName) {
      parts.push(`👤 *Cliente:* ${customerName}`);
    }

    if (isIfood) {
      let ifoodInfo = `🛒 *Origem:* iFood`;
      if (delivery.order_id) ifoodInfo += ` (#${delivery.order_id})`;
      if (delivery.ifood_id) ifoodInfo += ` - ID: ${delivery.ifood_id}`;
      if (delivery.confirmation_code) ifoodInfo += ` - Cód: ${delivery.confirmation_code}`;
      parts.push(ifoodInfo);
    } else {
      parts.push(`🛒 *Origem:* Loja Própria`);
    }

    parts.push(`🏠 *Endereço:* ${delivery.address_string}`);
    if (delivery.observation) {
      parts.push(`⚠️ *OBS:* ${delivery.observation}`);
    }

    if (delivery.is_paid) {
      parts.push(`📱 *Pagamento:* Pago no App ✅`);
    } else {
      const pMethod = delivery.payment_method?.toUpperCase().replace('_', ' ') || 'PAGAMENTO';
      if (delivery.payment_method === 'dinheiro') {
        if (delivery.change_for) {
          parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr} (Troco p/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')})`);
        } else {
          parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr} (Trocado)`);
        }
      } else if (delivery.payment_method?.includes('cartao') || (delivery.payment_method as string) === 'cartao') {
        parts.push(`💳 *Pagamento:* CARTÃO - R$ ${valueStr} (Levar maquininha)`);
      } else if (delivery.payment_method === 'pix') {
        parts.push(`💠 *Pagamento:* PIX QR Code - R$ ${valueStr} (Na maquininha)`);
      } else {
        parts.push(`💵 *Pagamento:* ${pMethod} - R$ ${valueStr}`);
      }
    }

    if (delivery.drinks) {
      parts.push(`🥤 *Bebida:* ${delivery.drinks.trim()}`);
    }

    parts.push(''); 

    if (delivery.maps_link) {
      parts.push(`🗺️ *Mapa:* ${delivery.maps_link}`);
    } else {
      const cleanAddress = delivery.address_string.toLowerCase().includes('patos de minas') 
        ? delivery.address_string 
        : `${delivery.address_string}, Patos de Minas - MG`;
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

// ============================================================================
// AUXILIARES DA MENSAGEM DA ROTA
// ============================================================================
const getNumberEmoji = (num: number) => {
  const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  return emojis[num] || `${num}️⃣`;
};

// ============================================================================
// 2. GERAR MENSAGENS DE ROTA (FORMATO EXECUTIVO - OPÇÃO 1)
// ============================================================================
export async function generateRouteMessages(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  getCustomerById: (id: string) => Customer | undefined
): Promise<{ success: boolean; hasFuzzyAddresses: boolean; fuzzyList: any[]; messages: string[] }> {
  try {
    let hasFuzzyAddresses = false;
    const fuzzyDeliveries: any[] = [];
    
    // MENSAGEM 1: LOGÍSTICA
    const msg1: string[] = [];
    // MENSAGEM 2: ACERTO
    const msg2: string[] = [];

    const totalDeliveries = deliveries.length;
    const drinksSummary: Record<string, { qty: number, name: string }> = {};

    msg1.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Tenta pegar o ID da Rota apenas com o número ("Rota 1", "Rota 2")
    const matchRouteNumber = route.name.match(/\d+/);
    const routeNumberStr = matchRouteNumber ? matchRouteNumber[0] : '1';
    
    msg1.push(`🏍️ *ROTA ${getNumberEmoji(Number(routeNumberStr))} - ${route.motoboy_name.toUpperCase()}* *(${totalDeliveries} Entregas)*\n`);
    msg1.push(`📦 *RESUMO DAS PARADAS:*\n`);

    const routeMapAddresses: string[] = []; 

    // Identifica bairros duplicados
    const neighborhoodCounts = deliveries.reduce((acc: any, d) => {
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
      
      const hasNumber = /\d/.test(delivery.address_string);
      const isFuzzy = !hasNumber && !customer?.maps_link;
      
      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: delivery.id, index: num, name: customer?.name || 'Cliente', address: delivery.address_string, neighborhood });
      }

      // Adiciona ao mapa usando o link do Ifood OU o endereço limpo (Sem caracteres que quebram link)
      if (customer?.maps_link && customer.maps_link.includes('http')) {
        routeMapAddresses.push(customer.maps_link);
      } else {
        const cleanAddress = delivery.address_string.replace(/[#&+\|]/g, '');
        const fullAddr = cleanAddress.toLowerCase().includes('patos de minas') 
          ? cleanAddress 
          : `${cleanAddress}, Patos de Minas - MG`;
        routeMapAddresses.push(fullAddr);
      }

      const clientName = customer?.name || 'Cliente';
      msg1.push(`*${emojiNum} ${clientName}* *(IFOOD ${shortId})*`);
      if (delivery.ifood_id) msg1.push(`*ID: [${delivery.ifood_id}]*\n`);
      else msg1.push(`\n`);

      msg1.push(`🏠 Endereço: ${street}`);
      msg1.push(` - \`${neighborhood}\`\n`);
      
      if (delivery.observation) msg1.push(`⚠️ *OBS:* ${delivery.observation}\n`);

      // Soma de Valores e Pagamento
      const valueStr = (delivery.value || 0).toFixed(2).replace('.', ',');

      if (delivery.value === 1) {
        msg1.push(`- 💵 *Pagamento*: *R$ 1,00 (Cartão)*`);
        msg1.push(`- ⚠️ *UM REAL mesmo* (pedido proporcional)`);
      } else if (delivery.is_paid) {
         if (delivery.payment_method === 'pix') msg1.push(`- 📱 *Pagamento*: PIX Confirmado ✅`);
         else msg1.push(`- 📱 *Pagamento*: Pago ✅`);
      } else {
         if (delivery.payment_method === 'pix') {
           msg1.push(`- 📱 *Pagamento*: *R$ ${valueStr} (PIX QR)*`);
           msg1.push(`- ❌ *Ainda não pagou, cobrar na maquininha!*`);
         } else if (delivery.payment_method === 'dinheiro' && delivery.change_for) {
           const troco = delivery.change_for - (delivery.value || 0);
           msg1.push(`- 💵 *Pagamento*: R$ ${valueStr} *Troco: R$ ${troco.toFixed(2).replace('.', ',')}*`);
         } else {
           msg1.push(`- 💵 *Pagamento*: *R$ ${valueStr} (${delivery.payment_method?.toUpperCase() || 'DINHEIRO'})*`);
         }
      }

      // Bebidas
      if (delivery.drinks) {
        const rawDrinkStr = delivery.drinks.trim();
        msg1.push(`- 🥤 *Bebida*: ${rawDrinkStr}`);
        const match = rawDrinkStr.match(/^(\d+)\s+(.+)$/);
        let qty = 1; let drinkName = rawDrinkStr;
        if (match) { qty = parseInt(match[1], 10); drinkName = match[2].trim(); }
        const key = drinkName.toLowerCase();
        if (!drinksSummary[key]) drinksSummary[key] = { qty: 0, name: drinkName };
        drinksSummary[key].qty += qty;
      }
      
      msg1.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    });

    // MAPA NA MENSAGEM 1
    msg1.push(`🗺️ *ROTA OTIMIZADA:* \n`);
    msg1.push(`⚠️ *Já está com todas em sequência com as paradas só clicar no link e clicar em iniciar rota*\n`);
    
    if (routeMapAddresses.length > 0) {
      let mapUrl = '';
      if (routeMapAddresses.length === 1) {
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(storeAddress)}&destination=${encodeURIComponent(routeMapAddresses[0])}`;
      } else {
        const destination = routeMapAddresses[routeMapAddresses.length - 1];
        const waypoints = routeMapAddresses.slice(0, -1);
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(storeAddress)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
      }
      msg1.push(`${mapUrl}\n`);
    }

    if (fuzzyDeliveries.length > 0) {
      msg1.push(`*(🚨 Nota: ${fuzzyDeliveries.length === 1 ? 'A parada' : 'As paradas'} ${fuzzyDeliveries.map(f => f.index).join(', ')} possuem endereços simplificados).*`);
    }
    msg1.push(`━━━━━━━━━━━━━━━━━━━━━━`);

    // =================================================================
    // MENSAGEM 2: ACERTO FINANCEIRO E BAG
    // =================================================================
    
    const now = new Date();
    const timeString = `${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}m`;

    msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    msg2.push(`*ROTA ${getNumberEmoji(Number(routeNumberStr))}*:  ${getNumberEmoji(totalDeliveries)} *ENTREGAS*\n`);
    msg2.push(`*SAÍDA*: \`${timeString}\``);
    msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    msg2.push(`*SEQUÊNCIA:*\n`);

    deliveries.forEach((delivery, index) => {
      const num = index + 1;
      const customer = getCustomerById(delivery.customer_id);
      const neighborhood = customer?.neighborhood || delivery.address_string.split('-').pop()?.trim() || 'Bairro';
      const street = delivery.address_string.split(',')[0].trim();
      const isDuplicate = neighborhoodCounts[neighborhood] > 1;
      
      const streetLabel = isDuplicate ? ` (${street})` : '';
      const statusIcon = delivery.completed ? '✅' : '❌';
      const drinkIcon = delivery.drinks ? ` *(${delivery.drinks})*` : '';
      
      msg2.push(`${num}. ${neighborhood}${streetLabel}:\t\t\t${statusIcon}${drinkIcon}`);
    });

    msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    
    const drinkKeys = Object.keys(drinksSummary);
    if (drinkKeys.length > 0) {
      msg2.push(`🥤 *RESUMO DE BEBIDAS (BAG):*\n`);
      msg2.push(`⚠️ *Pegar as bebidas antes de sair*\n`);
      drinkKeys.forEach(key => {
        msg2.push(`- *${drinksSummary[key].qty} ${drinksSummary[key].name}*`);
      });
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    }

    // DINHEIRO DESSA ROTA (Apenas itens não pagos previamente)
    const pendingMoney = deliveries.filter(d => !d.is_paid && d.payment_method === 'dinheiro');
    if (pendingMoney.length > 0) {
      msg2.push(`💵 *DINHEIRO DESSA ROTA:*\n`);
      let totalDinheiro = 0;

      pendingMoney.forEach((d, idx) => {
        const num = deliveries.findIndex(x => x.id === d.id) + 1;
        const val = d.value || 0;
        totalDinheiro += val;
        
        if (d.change_for) {
           const troco = d.change_for - val;
           msg2.push(`- \`R$ ${val.toFixed(2).replace('.', ',')}:\` ${getNumberEmoji(num)}  *(Voltou R$ ${troco.toFixed(2).replace('.', ',')} de troco)*`);
        } else {
           msg2.push(`- \`R$ ${val.toFixed(2).replace('.', ',')}:\` ${getNumberEmoji(num)}`);
        }
      });

      msg2.push(`\n● *TOTAL PRA ENTREGAR:* \`R$ ${totalDinheiro.toFixed(2).replace('.', ',')}\``);
      msg2.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    }

    // Retorna as duas mensagens blindadas
    return { success: true, hasFuzzyAddresses, fuzzyList: fuzzyDeliveries, messages: [msg1.join('\n'), msg2.join('\n')] };
  } catch (error) {
    console.error('Falha ao gerar mensagens da rota:', error);
    return { success: false, hasFuzzyAddresses: false, fuzzyList: [], messages: [] };
  }
}
