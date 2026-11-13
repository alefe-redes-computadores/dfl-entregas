/** R68 FIX1 — mensagens comerciais seguras, sem dados do pedido ou Firestore remoto. */
export type DeliveryRegistrationBusinessFeedback = {
  title: string;
  description: string;
  kind: 'duplicate' | 'in_progress' | 'invalid_batch' | 'business';
};

/** Reconhece SOMENTE erros de dominio existentes; falhas de rede/permissao ficam no tratamento anterior. */
export function deliveryRegistrationBusinessFeedback(
  rawMessage: string,
  origin: string,
): DeliveryRegistrationBusinessFeedback | null {
  const message = String(rawMessage || '').trim();
  if (!message || message.length > 1000) return null;
  const channel = origin === 'ifood' ? 'iFood' : origin === 'food99' ? '99Food' : origin === 'keeta' ? 'Keeta' : 'pedido';
  if (/^(?:Este pedido já foi importado\.|Um dos pedidos deste lote já foi importado\.|Pedido já registrado no Firestore por outro aparelho\.)/u.test(message)) {
    const batch = message.startsWith('Um dos pedidos deste lote');
    return {
      kind: 'duplicate',
      title: batch ? `Há pedido ${channel} já cadastrado no lote` : `Pedido ${channel} já cadastrado`,
      description: batch
        ? 'Pelo menos um ID deste lote já pertence a outro pedido registrado. Confira a lista e retire o duplicado antes de salvar.'
        : 'Este ID ou número comercial já pertence a um pedido registrado. Confira a lista e abra o pedido existente. Não altere o ID para contornar o bloqueio.',
    };
  }
  if (/^Este pedido ja esta sendo registrado\./u.test(message)) {
    return {
      kind: 'in_progress', title: 'Cadastro já em andamento',
      description: 'Este pedido ainda pode estar sendo gravado. Confira a lista antes de tentar novamente para evitar duplicidade.',
    };
  }
  if (/^Lote de importação com IDs repetidos ou inválidos\./u.test(message)) {
    return {
      kind: 'invalid_batch', title: 'Revise os IDs dos pedidos',
      description: 'O lote contém identificadores repetidos ou inválidos. Corrija os IDs conforme os pedidos originais antes de salvar.',
    };
  }
  if (/^Pedido cancelado não pode ser importado como entrega ativa\./u.test(message)) {
    return { kind: 'business', title: 'Pedido cancelado', description: message };
  }
  if (/^(?:99Food precisa|99Food exige)/u.test(message)) {
    return { kind: 'business', title: 'Revise o pedido 99Food', description: message };
  }
  if (/^(?:Keeta precisa|Keeta exige)/u.test(message)) {
    return { kind: 'business', title: 'Revise o pedido Keeta', description: message };
  }
  return null;
}
