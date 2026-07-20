import type { Delivery } from '@/types';

/**
 * Gera a linha de status de pagamento seguindo exatamente as regras:
 * [PAGO] ou [DINHEIRO] troco para [X] / [CARTÃO] levar maquininha
 */
function getPaymentLine(delivery: Delivery): string {
  if (delivery.is_paid) {
    return '[PAGO]';
  }

  switch (delivery.payment_method) {
    case 'dinheiro': {
      const change = delivery.change_for
        ? `R$ ${delivery.change_for.toFixed(2).replace('.', ',')}`
        : 'sem troco';
      return `[DINHEIRO] troco para ${change}`;
    }
    case 'cartao_credito':
    case 'cartao_debito':
      return '[CARTÃO] levar maquininha';
    case 'pix':
      return '[PIX] aguardando pagamento';
    default:
      return '';
  }
}

/**
 * Monta o texto formatado exatamente no padrão definido para o motoboy
 * copiar e colar no WhatsApp.
 */
export function formatDeliveryForWhatsApp(delivery: Delivery): string {
  const lines: string[] = [];

  lines.push(delivery.order_id);
  lines.push(delivery.address_string);

  if (delivery.observation && delivery.observation.trim().length > 0) {
    lines.push(`OBS: ${delivery.observation}`);
  }

  lines.push(`🗺️ ${delivery.maps_link}`);
  lines.push(getPaymentLine(delivery));

  if (delivery.drinks && delivery.drinks.trim().length > 0) {
    lines.push('');
    lines.push(delivery.drinks);
  }

  return lines.join('\n');
}

/**
 * Copia o texto formatado da entrega para a área de transferência.
 * Retorna true/false para o componente decidir o toast de feedback.
 */
export async function copyDeliveryToClipboard(delivery: Delivery): Promise<boolean> {
  const text = formatDeliveryForWhatsApp(delivery);

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback para contextos sem Clipboard API (webview antigo, http, etc.)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Erro ao copiar entrega para o WhatsApp:', error);
    return false;
  }
}
