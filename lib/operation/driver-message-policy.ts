/** R288: texto operacional derivado. Nunca altera estado financeiro ou confirmação comercial. */
export type DriverMessageDetailMode = 'compact' | 'guided';

export function driverMessageDetailMode(value?: string | null): DriverMessageDetailMode {
  return value === 'guided' ? 'guided' : 'compact';
}

const money = (value: number) => Math.max(0, Number(value) || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/**
 * Cobrança devida: não afirmar pagamento apenas porque o método é Pix/cartão.
 * A existência de QR/chave não é inferida; o texto pede a forma disponível na loja.
 */
export function driverCollectionInstruction(
  method: string | null | undefined,
  amount: number,
  paid: boolean,
  changeFor?: number | null,
): string {
  if (paid) return '✅ Pago';
  const value = `R$ ${money(amount)}`;
  if (method === 'pix') return `📱 Cobrar ${value} no Pix (QR/chave da loja) · confirmar recebimento`;
  if (method && /cart[aã]o|cartao|cr[eé]dito|d[eé]bito/i.test(method)) return `💳 Cobrar ${value} na maquininha`;
  if (!method || method === 'dinheiro') {
    const tendered = Number(changeFor) || 0;
    const change = Math.max(0, tendered - Math.max(0, Number(amount) || 0));
    return change > 0
      ? `💵 Cobrar ${value} em dinheiro · cliente entrega R$ ${money(tendered)} · troco R$ ${money(change)}`
      : `💵 Cobrar ${value} em dinheiro`;
  }
  return `💰 Cobrar ${value} · ${method.replace(/_/g, ' ')}`;
}

/** Rótulo conciso para imagem de paradas, incluindo misturas sem somar venda duas vezes. */
export function driverStopCollectionLabel(
  pending: readonly { payment_method?: string | null; amount: number }[],
): string {
  if (!pending.length) return 'PAGO';
  const amount = pending.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const value = `R$ ${money(amount)}`;
  if (pending.every(item => item.payment_method === 'pix')) return `COBRAR NO PIX ${value}`;
  if (pending.every(item => !!item.payment_method && /cart[aã]o|cartao|cr[eé]dito|d[eé]bito/i.test(item.payment_method))) return `COBRAR NA MAQUININHA ${value}`;
  if (pending.every(item => !item.payment_method || item.payment_method === 'dinheiro')) return `COBRAR EM DINHEIRO ${value}`;
  return `COBRAR ${value} · CONFERIR FORMAS`;
}
