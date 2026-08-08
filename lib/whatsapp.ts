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
// 2. COPIAR ROTA COMPLETA (COM SUPORTE A LINK MANUAL E FORÇAR PATOS DE MINAS)
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
    const deliveriesInMap: string[] = [];
    
    const drinksSummary: Record<string, { qty: number, name: string }> = {};

    parts.push(`🏍️ *ROTA DE ENTREGA - ${route.motoboy_name.toUpperCase()}*`);
    const cleanStoreAddress = storeAddress.toLowerCase().includes('patos de minas') ? storeAddress : `${storeAddress}, Patos de Minas - MG`;
    parts.push(`📍 *Base:* ${cleanStoreAddress}\n`);
    parts.push(`📦 *RESUMO DAS PARADAS:*\n`);

    deliveries.forEach((delivery, index) => {
      const customer = getCustomerById(delivery.customer_id);
      const name = customer?.name || 'Cliente Desconhecido';
      const isUrgent = (delivery as any).is_urgent;
      
      const hasNumber = /\d/.test(delivery.address_string);
      const isFuzzy = !hasNumber && !delivery.maps_link;

      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ id: delivery.id, index: index + 1, name, address: delivery.address_string, neighborhood: customer?.neighborhood });
      }

      // Prioridade máxima para link manual se existir, senão usa o endereço completo ancorado em Patos de Minas
      if (delivery.maps_link) {
        deliveriesInMap.push(delivery.maps_link);
      } else {
        const fullAddr = delivery.address_string.toLowerCase().includes('patos de minas') 
          ? delivery.address_string 
          : `${delivery.address_string}, Patos de Minas - MG`;
        deliveriesInMap.push(encodeURIComponent(fullAddr));
      }

      let title = `*${index + 1}️⃣ ${name}*`;
      if (delivery.origin === 'ifood') {
          title += ` (iFood`;
          if (delivery.order_id) title += ` #${delivery.order_id}`;
          if (delivery.ifood_id) title += ` - ID: ${delivery.ifood_id}`;
          if (delivery.confirmation_code) title += ` - Cód: ${delivery.confirmation_code}`;
          title += `)`;
      } else {
          title += ` (Loja)`;
      }
      if (isUrgent) title += ' 🚨';
      
      parts.push(title);
      parts.push(`🏠 Endereço: ${delivery.address_string}`);
      
      if (delivery.observation) parts.push(`⚠️ *OBS:* ${delivery.observation}`);

      const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';
      if (delivery.is_paid) {
        parts.push(`📱 Pagamento: Pago no App ✅`);
      } else {
        const pMethod = delivery.payment_method ? delivery.payment_method.toUpperCase().replace('_', ' ') : 'DINHEIRO';
        if (delivery.payment_method === 'dinheiro' && delivery.change_for) {
          parts.push(`💵 Pagamento: ${pMethod} - R$ ${valueStr} (Troco p/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')})`);
        } else {
          parts.push(`💵 Pagamento: ${pMethod} - R$ ${valueStr}`);
        }
      }

      if (delivery.drinks) {
        const rawDrinkStr = delivery.drinks.trim();
        parts.push(`🥤 Bebida: ${rawDrinkStr}`);

        const match = rawDrinkStr.match(/^(\d+)\s+(.+)$/);
        let qty = 1;
        let drinkName = rawDrinkStr;

        if (match) {
          qty = parseInt(match[1], 10);
          drinkName = match[2].trim();
        }

        const key = drinkName.toLowerCase();
        if (!drinksSummary[key]) {
          drinksSummary[key] = { qty: 0, name: drinkName };
        }
        drinksSummary[key].qty += qty;
      }
      
      if (isFuzzy && !delivery.maps_link) {
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

    if (deliveriesInMap.length > 0) {
        // Se houver links manuais misturados com endereços, construímos o maps dir de forma segura
        const mapUrl = `https://www.google.com/maps/dir/${encodeURIComponent(cleanStoreAddress)}/${deliveriesInMap.join('/')}`;
        parts.push(`🗺️ *ROTA INTELIGENTE (Google Maps):*`);
        parts.push(`${mapUrl}\n`);
    }

    if (fuzzyDeliveries.length > 0) {
      parts.push(`*(🚨 Nota: ${fuzzyDeliveries.length === 1 ? 'A entrega' : 'As entregas'} ${fuzzyDeliveries.map(f => f.index).join(', ')} possuem endereços simplificados).*`);
    }

    const textToCopy = parts.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    
    return { success: true, hasFuzzyAddresses, fuzzyList: fuzzyDeliveries };
  } catch (error) {
    console.error('Falha ao copiar rota completa:', error);
    return { success: false, hasFuzzyAddresses: false, fuzzyList: [] };
  }
}
