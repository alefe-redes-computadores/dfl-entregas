/** R34: texto portavel sem dados de pessoa, UID, cliente, rota, preco ou token. */
import type {ReleaseAssessment} from './staffReleasePolicy';
import {RELEASE_LABELS} from './staffReleasePolicy';
export function createSafeReleaseReport(a:ReleaseAssessment,producedAt:string):string {
  // Data gerada no cliente nunca copia a identidade da conta auditada.
  const at=Number.isFinite(Date.parse(producedAt))?new Date(producedAt).toISOString():'horario_indisponivel';
  return [
    'DFL ENTREGAS V111 R34 - DIAGNOSTICO SEM DADOS PESSOAIS',
    `Gerado: ${at}`,
    'DECISAO: BLOQUEADO PARA ATIVACAO (diagnostico nao concede acesso)',
    `Contas consultadas na amostra: ${a.samples.accounts}`,
    `Projecoes consultadas na prontidao: ${a.samples.readinessDocuments}`,
    `Documentos comparados na auditoria profunda: ${a.samples.deepDocuments}`,
    `Auditoria profunda executada: ${a.deepVerified?'sim':'nao'}`,
    'OBSERVACAO: amostras incompletas nao comprovam seguranca integral.',
    'Pendencias e verificacoes obrigatorias:',
    ...a.findings.map((finding,i)=>`${i+1}. ${RELEASE_LABELS[finding]}`),
    'NAO publicar Rules nem ativar funcionario com base neste relatorio.',
  ].join('\n')+'\n';
}
