/**
 * DFL R204 — preparo para publicacao; CHECKLIST NAO E AUTORIZACAO.
 * Helpers puros, sem rede, localStorage, firestore ou dados pessoais.
 */
export const RELEASE_CHECKS = [
  { id: 'apk_real', title: 'APK real instalado', detail: 'Instalar artefato assinado, testar login Google, voltar do segundo plano e notificacoes.' },
  { id: 'perfis_isolados', title: 'Permissoes em contas distintas', detail: 'Verificar owner, motoboy, compras e operacao; tentar abrir uma area proibida.' },
  { id: 'site_inbox', title: 'Site → Caixa de Entrada', detail: 'Pedido entra uma vez, aguarda aprovacao comercial e so depois recebe rota explicitamente.' },
  { id: 'food99_ifood', title: '99Food e iFood', detail: 'Importar IDs iguais em canais diferentes; conferir numero e logistica externa.' },
  { id: 'importacao_concorrente', title: 'Dois aparelhos ao mesmo tempo', detail: 'Cadastrar o mesmo pedido de plataforma simultaneamente; apenas uma criacao pode vencer.' },
  { id: 'offline_retorno', title: 'Offline e retorno', detail: 'Perder conexao, registrar acao permitida, reconectar e conferir duplicidades.' },
  { id: 'financeiro', title: 'Caixa, devolucao e acerto', detail: 'Conferir baixa, retorno fisico, dinheiro da rota e acerto sem lancamento duplicado.' },
] as const;
export type ReleaseCheckId = typeof RELEASE_CHECKS[number]['id'];
export type RulesEvidenceState = 'pendente' | 'owner_only_verificado' | 'bloqueado';
export type ReleaseReadinessStatus = 'BLOQUEADO' | 'PENDENTE_EVIDENCIA' | 'PRONTO_PARA_REVISAO';

export function assessReleaseReadiness(
  checked: readonly ReleaseCheckId[],
  rules: RulesEvidenceState = 'pendente',
): { done: number; total: number; missing: ReleaseCheckId[]; status: ReleaseReadinessStatus; note: string } {
  const valid = new Set(RELEASE_CHECKS.map(item => item.id));
  const done = new Set(checked.filter(item => valid.has(item)));
  const missing = RELEASE_CHECKS.map(item => item.id).filter(id => !done.has(id));
  const status: ReleaseReadinessStatus = rules === 'bloqueado' ? 'BLOQUEADO'
    : rules !== 'owner_only_verificado' || missing.length ? 'PENDENTE_EVIDENCIA' : 'PRONTO_PARA_REVISAO';
  const note = status === 'BLOQUEADO'
    ? 'Regras potencialmente inseguras: publicacao proibida ate revisao.'
    : status === 'PENDENTE_EVIDENCIA'
      ? 'Checklist e evidencias insuficientes. Nenhuma liberacao de producao.'
      : 'Conferencias declaradas concluidas. Ainda requer aprovacao explicita e prova verificavel.';
  return { done: done.size, total: RELEASE_CHECKS.length, missing, status, note };
}

export function releaseChecklistText(checked: readonly ReleaseCheckId[], rules: RulesEvidenceState = 'pendente'): string {
  const checkedSet = new Set(checked);
  const summary = assessReleaseReadiness(checked, rules);
  return [
    'DFL Entregas - R204 - Conferencia manual (NAO E CERTIFICADO)',
    `Regras publicadas: ${rules}`,
    `Situacao: ${summary.status}`,
    `Itens declarados conferidos: ${summary.done}/${summary.total}`,
    ...RELEASE_CHECKS.map(item => `${checkedSet.has(item.id) ? '[x]' : '[ ]'} ${item.title}`),
    'ATENCAO: marcacoes no app nao provam permissoes reais, rules implantadas ou APK homologado.',
    'Nao publicar sem validacao remota e autorizacao expressa.',
  ].join('\n');
}
