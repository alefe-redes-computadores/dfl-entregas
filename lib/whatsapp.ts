import type { Delivery } from '@/types';

export async function copyDeliveryToClipboard(delivery: Delivery): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood' || !delivery.origin;
    const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';

    // 1. ID do pedido e Código Longo (SOMENTE IFOOD)
    if (isIfood) {
      if (delivery.order_id && delivery.confirmation_code) {
        // Exemplo: *#8189* - ID: *12345678*
        parts.push(`*#${delivery.order_id}* - ID: *${delivery.confirmation_code}*`);
      } else if (delivery.order_id) {
         parts.push(`*#${delivery.order_id}*`);
      } else if (delivery.confirmation_code) {
         parts.push(`ID: *${delivery.confirmation_code}*`);
      }
      
      // Dá um respiro apenas se imprimiu algo do iFood
      if (delivery.order_id || delivery.confirmation_code) {
          parts.push(''); 
      }
    }

    // 2. Endereço
    parts.push(delivery.address_string);

    // 3. Observação (se houver, com destaque)
    if (delivery.observation) {
      parts.push(`*OBS:* ${delivery.observation}`);
    }

    // 4. Link do Maps (se houver)
    if (delivery.maps_link) {
      parts.push(`🗺️ ${delivery.maps_link}`);
    }

    parts.push(''); // Linha em branco antes do pagamento e bebida

    // 5. Forma de Pagamento e Valores
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

    // 6. Bebidas (Com Bullets e Negrito, se houver - Com trim() para não quebrar o WhatsApp)
    if (delivery.drinks) {
      parts.push(`- *${delivery.drinks.trim()}*`);
    }

    // Junta todas as partes com quebras de linha reais
    const textToCopy = parts.join('\n');

    await navigator.clipboard.writeText(textToCopy);
    return true;
  } catch (error) {
    console.error('Falha ao copiar:', error);
    return false;
  }
}
