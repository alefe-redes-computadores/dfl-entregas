/** Mensagens operacionais compartilhadas; o chamador continua responsável pela persistência. */
export type ActionProgress = 'saving' | 'syncing' | 'done' | 'failed';
export type OperationalAction = 'pedido' | 'entrega' | 'rota' | 'pagamento' | 'estoque' | 'cadastro';

const names: Record<OperationalAction,string> = {
  pedido:'pedido', entrega:'entrega', rota:'rota', pagamento:'pagamento',
  estoque:'movimentação de estoque', cadastro:'cadastro',
};
/** Nunca exibir sucesso antecipadamente: done somente após confirmação do write. */
export const operationalFeedback = (action: OperationalAction, progress: ActionProgress): string => {
  const name = names[action];
  if (progress === 'saving') return `Salvando ${name}…`;
  if (progress === 'syncing') return `Atualizando ${name}…`;
  if (progress === 'done') return `Atualização de ${name} confirmada.`;
  return `Não foi possível concluir ${name}. Os dados precisam ser conferidos antes de tentar novamente.`;
};
