import type { Delivery } from '@/types';

export async function copyDeliveryToClipboard(delivery: Delivery): Promise<boolean> {
  try {
    const parts: string[] = [];
    const isIfood = delivery.origin === 'ifood' || !delivery.origin;
    const valueStr = delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00';

    // 1. Número do pedido e ID lado a lado em negrito (SOMENTE IFOOD)
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

    // 2. Endereço
    parts.push(delivery.address_string);

    // 3. Observação (se houver, com destaque)
    if (delivery.observation) {
      parts.push(`*OBS:* ${delivery.observation}`);
    }

    // 4. Link do Maps (Usa o colado OU gera um automático pela rua)
    if (delivery.maps_link) {
      parts.push(`🗺️ ${delivery.maps_link}`);
    } else if (delivery.address_string) {
      // Magia: Gera um link de busca do Google Maps se não houver link colado
      const encodedAddress = encodeURIComponent(`${delivery.address_string}, Patos de Minas - MG`);
      parts.push(`🗺️ https://maps.google.com/?q=${encodedAddress}`);
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

    // 6. Bebidas (Com trim() para arrumar o espaço fantasma que quebra o WhatsApp)
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
