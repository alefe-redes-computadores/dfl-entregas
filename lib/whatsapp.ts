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
// 2. COPIAR ROTA COMPLETA (AGRUPAMENTO INTELIGENTE + GOOGLE MAPS API OFICIAL)
// ============================================================================
export async function copyFullRouteToClipboard(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  getCustomerById: (id: string) => Customer | undefined
): Promise<{ success: boolean; hasFuzzyAddresses: boolean; fuzzyList: any[] }> {
  try {
    const parts: string[] = [];
    let hasFuzzyAddresses = false;
    const fuzzyDeliveries: any[] = [];
    
    // AGRUPAMENTO DE ENDEREÇOS IGUAIS (Mescla múltiplos pedidos para o mesmo endereço)
    const groupedDeliveries: Delivery[][] = [];
    const addressMap = new Map<string, number>();

    deliveries.forEach(d => {
      const key = d.address_string.toLowerCase().trim();
      if (addressMap.has(key)) {
          groupedDeliveries[addressMap.get(key)!].push(d);
      } else {
          addressMap.set(key, groupedDeliveries.length);
          groupedDeliveries.push([d]);
      }
    });

    const drinksSummary: Record<string, { qty: number, name: string }> = {};

    parts.push(`🏍️ *ROTA DE ENTREGA - ${route.motoboy_name.toUpperCase()}*`);
    const cleanStoreAddress = storeAddress.toLowerCase().includes('patos de minas') ? storeAddress : `${storeAddress}, Patos de Minas - MG`;
    parts.push(`📍 *Base:* ${cleanStoreAddress}\n`);
    parts.push(`📦 *RESUMO DAS PARADAS:*\n`);

    const routeMapAddresses: string[] = []; // Endereços para o link do Maps (sem shortlinks)

    groupedDeliveries.forEach((group, index) => {
      // Pega dados base da primeira entrega do grupo
      const firstDelivery = group[0];
      const customer = getCustomerById(firstDelivery.customer_id);
      
      const hasNumber = /\d/.test(firstDelivery.address_string);
      const isFuzzy = !hasNumber && !firstDelivery.maps_link;

      // Nomes de clientes combinados e sem repetir
      const uniqueNames = Array.from(new Set(group.map(d => getCustomerById(d.customer_id)?.name || 'Cliente')));
      const namesStr = uniqueNames.join(' & ');

      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: firstDelivery.id, index: index + 1, name: namesStr, address: firstDelivery.address_string, neighborhood: customer?.neighborhood });
      }

      // Adiciona ao mapa usando o endereço textual para não quebrar a API de multi-paradas
      const fullAddr = firstDelivery.address_string.toLowerCase().includes('patos de minas') 
        ? firstDelivery.address_string 
        : `${firstDelivery.address_string}, Patos de Minas - MG`;
      routeMapAddresses.push(fullAddr);

      // Tratamento de IDs do iFood
      const ifoodIds = group.filter(d => d.order_id).map(d => `#${d.order_id}`).join(', ');
      let originTitle = '';
      if (ifoodIds) {
          originTitle = `(iFood ${ifoodIds})`;
      } else if (group.some(d => d.origin === 'loja')) {
          originTitle = `(Loja)`;
      }

      const isUrgent = group.some(d => (d as any).is_urgent);
      
      let title = `*${index + 1}️⃣ ${namesStr}* ${originTitle}`;
      if (isUrgent) title += ' 🚨';
      if (group.length > 1) title += ' 📦*(MÚLTIPLA)*';
      
      parts.push(title);
      parts.push(`🏠 Endereço: ${firstDelivery.address_string}`);
      
      // Junta observações
      const obsList = group.filter(d => d.observation).map(d => d.observation);
      if (obsList.length > 0) {
        parts.push(`⚠️ *OBS:* ${obsList.join(' | ')}`);
      }

      // Soma dos valores
      const totalValue = group.reduce((acc, d) => acc + (d.value || 0), 0);
      const valueStr = totalValue.toFixed(2).replace('.', ',');

      // Pagamentos Mesclados
      const allPaid = group.every(d => d.is_paid);
      if (allPaid) {
        parts.push(`📱 Pagamento: Pago no App ✅`);
      } else {
        const methods = group.map(d => {
            if (d.is_paid) return 'Pago App';
            if (d.payment_method === 'dinheiro' && d.change_for) {
               return `Dinheiro (Troco p/ R$ ${d.change_for.toFixed(2).replace('.', ',')})`;
            }
            return d.payment_method ? d.payment_method.toUpperCase().replace('_', ' ') : 'DINHEIRO';
        });
        const methodsStr = Array.from(new Set(methods)).join(' + ');
        parts.push(`💵 Pagamento: ${methodsStr} - TOTAL: R$ ${valueStr}`);
      }

      // Bebidas Mescladas
      group.forEach(d => {
        if (d.drinks) {
          const rawDrinkStr = d.drinks.trim();
          parts.push(`🥤 Bebida: ${rawDrinkStr}`);
          const match = rawDrinkStr.match(/^(\d+)\s+(.+)$/);
          let qty = 1; let drinkName = rawDrinkStr;
          if (match) { qty = parseInt(match[1], 10); drinkName = match[2].trim(); }
          const key = drinkName.toLowerCase();
          if (!drinksSummary[key]) drinksSummary[key] = { qty: 0, name: drinkName };
          drinksSummary[key].qty += qty;
        }
      });
      
      if (isFuzzy && !firstDelivery.maps_link) {
          parts.push(`❌ *Atenção:* Endereço incompleto/sem número. Verifique no mapa.`);
      }

      parts.push('');
    });

    const drinkKeys = Object.keys(drinksSummary);
    if (drinkKeys.length > 0) {
      parts.push(`🥤 *RESUMO DE BEBIDAS (MOCHILA):*`);
      drinkKeys.forEach(key => {
        parts.push(`- *${drinksSummary[key].qty} ${drinksSummary[key].name}*`);
      });
      parts.push('');
    }

    parts.push(`━━━━━━━━━━━━━━━━━━━━━━`);

    // GERADOR OFICIAL GOOGLE MAPS DIREÇÕES (INFALÍVEL NO ANDROID/IOS)
    if (routeMapAddresses.length > 0) {
      let mapUrl = '';
      if (routeMapAddresses.length === 1) {
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanStoreAddress)}&destination=${encodeURIComponent(routeMapAddresses[0])}`;
      } else {
        const destination = routeMapAddresses[routeMapAddresses.length - 1];
        const waypoints = routeMapAddresses.slice(0, -1);
        mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanStoreAddress)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
      }
      parts.push(`🗺️ *ROTA INTELIGENTE (Google Maps):*`);
      parts.push(`${mapUrl}\n`);
    }

    if (fuzzyDeliveries.length > 0) {
      parts.push(`*(🚨 Nota: ${fuzzyDeliveries.length === 1 ? 'A parada' : 'As paradas'} ${fuzzyDeliveries.map(f => f.index).join(', ')} possuem endereços simplificados).*`);
    }

    const textToCopy = parts.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    
    return { success: true, hasFuzzyAddresses, fuzzyList: fuzzyDeliveries };
  } catch (error) {
    console.error('Falha ao copiar rota completa:', error);
    return { success: false, hasFuzzyAddresses: false, fuzzyList: [] };
  }
}
