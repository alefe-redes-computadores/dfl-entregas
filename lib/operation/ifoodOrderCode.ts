/**
 * Código de confirmação é dado do PEDIDO, não do cadastro do cliente.
 * Um histórico de cliente pode facilitar uma conferência manual, mas nunca
 * autoriza preencher a fila pós-rota ou as mensagens de outro pedido.
 * Não truncar códigos com mais de quatro dígitos: seriam valores incorretos.
 */
export function orderConfirmationCode(value?: string | null): string {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length === 4 ? digits : '';
}
