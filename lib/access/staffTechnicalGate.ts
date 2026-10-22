/** R37 — gate técnico puro. NUNCA entrega autorização, publica regras ou avalia testes remotos por suposição. */
import type { ReadinessSummary } from './staffReadinessPolicy';
export type GateState = 'pending'|'blocked'|'observed';
export type TechnicalCheck = {id:string;label:string;detail:string;state:GateState};
export interface TechnicalGate {
  technicalStatus:'preparation_only';staffActivation:'blocked';publication:'requires_explicit_owner_action';
  sampleDocuments:number;flagsEnabled:number;checks:TechnicalCheck[];readyForRelease:false;
}
/** A aplicação NÃO recebe resultado autenticado do CI nem leitura real das Rules. */
export function assessTechnicalGate(readiness:ReadinessSummary|null):TechnicalGate {
 const flags=readiness?.flags;
 const flagsEnabled=flags?[flags.staffPortal,flags.staffRequests,flags.canonicalApply,flags.projectionRefresh].filter(Boolean).length:0;
 const sampleDocuments=readiness?.projectionHealth?.sampled||0;
 const stamp=readiness?Date.parse(readiness.checkedAt):NaN;
 const checked=readiness?.ok===true&&Number.isFinite(stamp)&&stamp<=Date.now()+60_000&&stamp>=Date.now()-15*60_000;
 const allFlagsReported=typeof flags?.projectionRefresh==='boolean';
 const unexpected=Boolean(readiness&&(readiness.accountsTruncated||readiness.requestsTruncated||
   (!readiness.accounts.length)||readiness.accounts.some(a=>a.status!=='suspended'||a.issues.length>0||Object.keys(a.projectionRisks||{}).length>0)||
   readiness.projectionHealth?.unsafe||readiness.projectionHealth?.unknown||
   readiness.requests.pending||readiness.requests.inFlight));
 const checks:TechnicalCheck[]=[
  {id:'local',label:'TypeScript e PRE-APK',detail:'Exige log local da R37 com todas as suítes preservadas; relatórios antigos não comprovam a instalação atual.',state:'pending'},
  {id:'diff',label:'Inventário R27–R37',detail:'Exige diff real no Termux, SHA256 e revisão do lote antes de commit seletivo.',state:'pending'},
  {id:'emulator',label:'Firebase Emulator isolado',detail:'Exige log real da execução R36/R37 no projeto demo. Workflow preparado não é execução aprovada.',state:'pending'},
  {id:'cloud',label:'CI e Vercel',detail:'Conferir execução da Action e implantação somente após publicação autorizada; não há verificação automática nesta tela.',state:'pending'},
  {id:'rules',label:'Firestore Rules em produção',detail:'Conferir OWNER-ONLY no Console. Não presumir que arquivo local está implantado.',state:'pending'},
  {id:'flags',label:'Portas operacionais de equipe',detail:!checked?'Ainda não consultadas; configuração em produção é desconhecida.':!allFlagsReported?'A quarta flag não foi informada pelo servidor; atualizar e revisar o backend.':flagsEnabled?`${flagsEnabled} porta(s) configurada(s); verificar imediatamente.`:'Quatro portas reportadas desligadas nesta amostra de leitura.',state:!checked||!allFlagsReported||flagsEnabled?'blocked':'observed'},
  {id:'sample',label:'Prontidão e projeções',detail:!checked?'Diagnóstico ausente, inválido ou com mais de 15 minutos; consulte novamente.':unexpected?'Há ressalvas ou divergências na amostra.':'Amostra sem alertas declarados; não garante cobertura completa.',state:!checked||unexpected?'blocked':'observed'},
  {id:'identity',label:'Identidade, domínios e dispositivo',detail:'Homologação separada de login Google, revogação/offline, isolamento e fluxo real continua obrigatória.',state:'pending'},
 ];
 return {technicalStatus:'preparation_only',staffActivation:'blocked',publication:'requires_explicit_owner_action',sampleDocuments,flagsEnabled,checks,readyForRelease:false};
}
export function safeTechnicalGateReport(value:TechnicalGate,at:string):string {
 const timestamp=Number.isFinite(Date.parse(at))?new Date(at).toISOString():'indisponivel';
 return ['DFL ENTREGAS V111 R37 — GATE TECNICO INFORMATIVO',`Gerado: ${timestamp}`,
  'PUBLICACAO: AGUARDANDO AUTORIZACAO EXPLICITA DO PROPRIETARIO',
  'ATIVACAO STAFF: BLOQUEADA, INDEPENDENTEMENTE DOS TESTES',
  'O aplicativo nao confirma CI, Emulator nem Rules da producao.',
  `Projecoes amostradas no ultimo diagnostico manual: ${value.sampleDocuments}`,
  'Consultas Firestore cobradas: NAO MEDIDAS; veja o painel de orçamento R38.',
  `Portas habilitadas segundo o diagnostico (quando disponivel): ${value.flagsEnabled}`,
  ...value.checks.map(x=>`[${x.state.toUpperCase()}] ${x.label}: ${x.detail}`),
  'Nenhum UID, nome, endereco, telefone, pagamento ou dado de cliente compoe este relatorio.',
 ].join('\n')+'\n';
}
