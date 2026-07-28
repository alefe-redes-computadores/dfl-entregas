import type { Delivery, Route, Customer } from '@/types';

// ============================================================================
// 1. COPIAR ENTREGA ÚNICA
// ============================================================================
export async function copyDeliveryToClipboard(delivery: Delivery): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood' || !delivery.origin;
    const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';
    const isUrgent = delivery.is_urgent;

    if (isUrgent) {
      parts.push(`🚨 *ENTREGA URGENTE* 🚨\n`);
    }

    if (isIfood) {
      if (delivery.order_id && delivery.confirmation_code) {
        parts.push(`*#${delivery.order_id}* - *ID: ${delivery.confirmation_code}*`);
      } else if (delivery.order_id) {
         parts.push(`*#${delivery.order_id}*`);
      } else if (delivery.confirmation_code) {
         parts.push(`*ID: ${delivery.confirmation_code}*`);
      }
      
      if (delivery.order_id || delivery.confirmation_code) {
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

    parts.push(`🏍️ *ROTA DE ENTREGA - ${route.motoboy_name.toUpperCase()}*`);
    parts.push(`📍 *Base:* ${storeAddress}\n`);

    // Geração do Link do Maps com Waypoints na ordem exata
    const waypoints = deliveries.map(d => encodeURIComponent(d.address_string)).join('/');
    const mapUrl = `https://www.google.com/maps/dir/${encodeURIComponent(storeAddress)}/${waypoints}`;
    
    parts.push(`🗺️ *LINK DO MAPA (Siga a Ordem):*`);
    parts.push(`${mapUrl}\n`);
    parts.push(`📦 *RESUMO DAS PARADAS:*\n`);

    deliveries.forEach((delivery, index) => {
      const customer = getCustomerById(delivery.customer_id);
      const name = customer?.name || 'Cliente Desconhecido';
      const isUrgent = delivery.is_urgent;
      
      // Heurística de Endereço Impreciso (Sem número e sem link exato do maps)
      const hasNumber = /\d/.test(delivery.address_string);
      const isFuzzy = !hasNumber && !delivery.maps_link;

      if (isFuzzy) {
        hasFuzzyAddresses = true;
        fuzzyDeliveries.push({ index: index + 1, name, address: delivery.address_string, neighborhood: customer?.neighborhood });
      }

      // Título da Parada numerado
      parts.push(`*${index + 1}. ${name}* ${isUrgent ? '🚨 (URGENTE)' : ''}`);
      
      // Endereço
      parts.push(`📍 ${delivery.address_string}`);
      if (delivery.observation) parts.push(`*OBS:* ${delivery.observation}`);

      // Pagamento
      const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';
      if (delivery.is_paid) {
        parts.push(`💳 *PAGO*`);
      } else {
        const pMethod = delivery.payment_method.toUpperCase().replace('_', ' ');
        if (delivery.payment_method === 'dinheiro' && delivery.change_for) {
          parts.push(`💵 *${pMethod}* - R$ ${valueStr} (Levar troco p/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')})`);
        } else {
          parts.push(`💵 *${pMethod}* - R$ ${valueStr}`);
        }
      }

      // Bebidas
      if (delivery.drinks) parts.push(`🥤 *${delivery.drinks.trim()}*`);
      
      parts.push(''); // Pula uma linha entre entregas
    });

    // Se encontrou endereços problemáticos, cria um rodapé de alerta para não passar batido
    if (fuzzyDeliveries.length > 0) {
      parts.push(`⚠️ *ATENÇÃO: ENDEREÇOS POSSIVELMENTE IMPRECISOS (Sem número/Link)*`);
      fuzzyDeliveries.forEach(fd => {
        parts.push(`- *Parada ${fd.index} (${fd.name}):* O GPS pode falhar. Procure pelo bairro: *${fd.neighborhood || 'Não informado'}*.`);
      });
    }

    const textToCopy = parts.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    
    return { success: true, hasFuzzyAddresses };
  } catch (error) {
    console.error('Falha ao copiar rota completa:', error);
    return { success: false, hasFuzzyAddresses: false };
  }
}
