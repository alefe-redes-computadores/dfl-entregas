import type { Delivery, Route, Customer } from '@/types';

// ============================================================================
// 1. COPIAR ENTREGA ÚNICA
// ============================================================================
export async function copyDeliveryToClipboard(delivery: Delivery): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood' || !delivery.origin;
    const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';
    const isUrgent = (delivery as any).is_urgent;

    if (isUrgent) {
      parts.push(`🚨 *ENTREGA URGENTE* 🚨\n`);
    }

    if (isIfood) {
      const ifoodParts = [];
      if (delivery.order_id) ifoodParts.push(`*#${delivery.order_id}*`);
      if (delivery.ifood_id) ifoodParts.push(`*ID: ${delivery.ifood_id}*`);
      if (delivery.confirmation_code) ifoodParts.push(`*Cód: ${delivery.confirmation_code}*`);
      
      if (ifoodParts.length > 0) {
          parts.push(ifoodParts.join(' - '));
          parts.push(''); 
      }
    }

    parts.push(delivery.address_string);

    if (delivery.observation) {
      parts.push(`*OBS:* ${delivery.observation}`);
    }

    if (delivery.maps_link) {
      parts.push(`🗺️ ${delivery.maps_link}`);
    } else if (delivery.address_string) {
      const encodedAddress = encodeURIComponent(`${delivery.address_string}, Patos de Minas - MG`);
      parts.push(`🗺️ https://maps.google.com/?q=${encodedAddress}`);
    }

    parts.push(''); 

    if (delivery.is_paid) {
      parts.push(`- *PAGO*`);
    } else {
      if (delivery.payment_method === 'dinheiro') {
        if (delivery.change_for) {
          parts.push(`- *DINHEIRO* - R$ ${valueStr} (Levar troco para R$ ${delivery.change_for.toFixed(2).replace('.', ',')})`);
        } else {
          parts.push(`- *DINHEIRO* - R$ ${valueStr} (Trocado)`);
        }
      } else if (delivery.payment_method?.includes('cartao') || (delivery.payment_method as string) === 'cartao') {
        parts.push(`- *CARTÃO* - R$ ${valueStr} (Levar maquininha)`);
      } else if (delivery.payment_method === 'pix') {
        parts.push(`- *PIX QR Code na maquininha* - R$ ${valueStr}`);
      } else {
        parts.push(`- *${delivery.payment_method?.toUpperCase() || 'PAGAMENTO'}* - R$ ${valueStr}`);
      }
    }

    if (delivery.drinks) {
      parts.push(`- *${delivery.drinks.trim()}*`);
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
// 2. COPIAR ROTA COMPLETA (MAPA DE GUERRA)
// ============================================================================
export async function copyFullRouteToClipboard(
  route: Route,
  deliveries: Delivery[],
  storeAddress: string,
  getCustomerById: (id: string) => Customer | undefined
): Promise<{ success: boolean; hasFuzzyAddresses: boolean }> {
  try {
    const parts: string[] = [];
    let hasFuzzyAddresses = false;
    const fuzzyDeliveries: any[] = [];
    const deliveriesInMap: string[] = [];

    parts.push(`🏍️ *ROTA DE ENTREGA - ${route.motoboy_name.toUpperCase()}*`);
    parts.push(`📍 *Base:* ${storeAddress}\n`);
    parts.push(`📦 *RESUMO DAS PARADAS:*\n`);

    deliveries.forEach((delivery, index) => {
      const customer = getCustomerById(delivery.customer_id);
      const name = customer?.name || 'Cliente Desconhecido';
      const isUrgent = (delivery as any).is_urgent;
      
      const hasNumber = /\d/.test(delivery.address_string);
      const isFuzzy = !hasNumber && !delivery.maps_link;

      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ index: index + 1, name, address: delivery.address_string, neighborhood: customer?.neighborhood });
      } else {
        deliveriesInMap.push(encodeURIComponent(delivery.address_string));
      }

      // 🔥 TÍTULO COM OS 3 DADOS SEPARADOS (Nº, ID e CÓDIGO)
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
        const pMethod = delivery.payment_method.toUpperCase().replace('_', ' ');
        if (delivery.payment_method === 'dinheiro' && delivery.change_for) {
          parts.push(`💵 Pagamento: ${pMethod} - R$ ${valueStr} (Troco p/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')})`);
        } else {
          parts.push(`💵 Pagamento: ${pMethod} - R$ ${valueStr}`);
        }
      }

      if (delivery.drinks) parts.push(`🥤 Bebida: ${delivery.drinks.trim()}`);
      
      if (isFuzzy) {
          parts.push(`❌ *Atenção:* Esta entrega não possui número no endereço e não está inclusa no link automático abaixo.`);
      }

      parts.push('');
    });

    parts.push(`━━━━━━━━━━━━━━━━━━━━━━`);

    if (deliveriesInMap.length > 0) {
        const waypoints = deliveriesInMap.join('/');
        const mapUrl = `https://www.google.com/maps/dir/${encodeURIComponent(storeAddress)}/${waypoints}`;
        parts.push(`🗺️ *ROTA INTELIGENTE (Google Maps):*`);
        parts.push(`${mapUrl}\n`);
    }

    if (fuzzyDeliveries.length > 0) {
      parts.push(`*(🚨 Nota: ${fuzzyDeliveries.length === 1 ? 'A entrega' : 'As entregas'} ${fuzzyDeliveries.map(f => f.index).join(', ')} não ${fuzzyDeliveries.length === 1 ? 'está inclusa' : 'estão inclusas'} no link automático. Verifique o endereço manualmente).*`);
    }

    const textToCopy = parts.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    
    return { success: true, hasFuzzyAddresses };
  } catch (error) {
    console.error('Falha ao copiar rota completa:', error);
    return { success: false, hasFuzzyAddresses: false };
  }
}
