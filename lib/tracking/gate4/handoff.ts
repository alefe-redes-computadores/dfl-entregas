/** R253 Gate4 owner-safe handoff: no private orders, tokens, account identifiers, values or secrets. */
export type Gate4Mode = 'OFF'|'DRY_RUN'|'MANUAL'|'AUTOMATIC_CERTIFIED';
export type Gate4Status = 'off'|'needs_configuration'|'requires_joint_certification';
export type Gate4CheckId = 'A'|'B'|'C'|'D'|'E';
export type Gate4Check = { id:Gate4CheckId; label:string; state:'defined'|'off'|'review'; note:string };
export type Gate4Handoff = {
  contract:'dfl.tracking.gate4.handoff'; version:1;
  scope:'owner_only'; generated_at:string;
  integration_status:Gate4Status;
  public_links_issued_by_diagnostic:false;
  messages_sent_by_diagnostic:false;
  code_enabled:boolean; tenant_configured:boolean; s2s_keyset_configured:boolean;
  customer_access_certified:boolean; company_mode:Gate4Mode;
  kill_switch:boolean; public_tracking:boolean; issue_tracking_link:boolean;
  checks:Gate4Check[];
  next_actions:string[];
};
export type Gate4Inputs = {
  codeEnabled:boolean;
  tenantConfigured:boolean;
  keysetConfigured:boolean;
  customerCertified:boolean;
  capability?:{ mode?:unknown;kill_switch?:unknown;public_tracking?:unknown;issue_tracking_link?:unknown }|null;
};
const modes = ['OFF','DRY_RUN','MANUAL','AUTOMATIC_CERTIFIED'] as const;
export function validateKeysetShape(raw: string|undefined): boolean {
  if(!raw || raw.length>4096)return false;
  try {
    const o:unknown=JSON.parse(raw);
    if(!o||typeof o!=='object'||Array.isArray(o))return false;
    const keys=Object.entries(o as Record<string,unknown>);
    return keys.length>=1 && keys.length<=4 && keys.every(([key,value])=>
      /^[A-Za-z0-9_-]{3,24}$/.test(key) && typeof value==='string' && value.length>=32 && value.length<=512);
  }catch{return false;}
}
export function evaluateGate4(input:Gate4Inputs, now=new Date().toISOString()):Gate4Handoff {
  if(!Number.isFinite(Date.parse(now)))throw Error('Invalid report timestamp');
  const raw=input.capability||{};
  const mode:Gate4Mode=modes.includes(raw.mode as Gate4Mode)?raw.mode as Gate4Mode:'OFF';
  const kill=raw.kill_switch!==false;
  const pub=raw.public_tracking===true;
  const issue=raw.issue_tracking_link===true;
  const status:Gate4Status=!input.codeEnabled||kill||mode==='OFF'||!pub||!issue||!input.customerCertified
    ?'off':!input.tenantConfigured||!input.keysetConfigured?'needs_configuration':'requires_joint_certification';
  return {
    contract:'dfl.tracking.gate4.handoff',version:1,scope:'owner_only',generated_at:new Date(now).toISOString(),
    integration_status:status,public_links_issued_by_diagnostic:false,messages_sent_by_diagnostic:false,
    code_enabled:input.codeEnabled,tenant_configured:input.tenantConfigured,s2s_keyset_configured:input.keysetConfigured,
    customer_access_certified:input.customerCertified,company_mode:mode,kill_switch:kill,
    public_tracking:pub,issue_tracking_link:issue,
    checks:[
      {id:'A',label:'Eventos confirmados',state:'defined',note:'A certificação por pedido continua separada. Este diagnóstico não comprova eventos reais.'},
      {id:'B',label:'Projeção pública',state:'defined',note:'Schema V1 validado localmente, sem expor pedidos ou dados financeiros.'},
      {id:'C',label:'Sessão e credenciais',state:input.tenantConfigured&&input.keysetConfigured?'review':'off',note:'O Site ainda precisa comprovar cookie, troca e revogação no navegador.'},
      {id:'D',label:'WhatsApp',state:'off',note:'Nenhuma intenção é transmitida por esta ferramenta.'},
      {id:'E',label:'Proteções',state:status==='off'?'off':'review',note:'Configuração analisada sem habilitar funcionalidades.'},
    ],
    next_actions:[
      'Site: implementar /acompanhar e sessão HttpOnly sem expor token ao navegador após a troca.',
      'Site e Entregas: testar assinatura, replay, tenant e revogação de sessão ativa em ambiente homologado.',
      'Manter envio real e acesso público desligados até autorização específica.',
    ],
  };
}
/** Exports exactly the privacy-safe aggregate; may be copied into the Site chat. */
export function formatGate4HandoffForSite(r:Gate4Handoff): string {
  return [
    'DFL ENTREGAS → DFL SITE — R253 GATE4 (somente diagnóstico)',
    `Versão: ${r.contract} v${r.version}; verificação: ${r.generated_at}`,
    `Backend habilitado: ${r.code_enabled?'sim':'não'}; tenant configurado: ${r.tenant_configured?'sim':'não'}.`,
    `Chaves S2S estruturalmente configuradas: ${r.s2s_keyset_configured?'sim':'não'}; cliente certificado: ${r.customer_access_certified?'sim':'não'}.`,
    `Modo: ${r.company_mode}; bloqueio de emergência: ${r.kill_switch?'ATIVO':'inativo'}.`,
    `Integração: ${r.integration_status}.`,
    'Não há comprovação E2E sem a página do Site e homologação conjunta.',
    'Nenhum token, identificador de pedido, contato, valor financeiro ou segredo foi exportado.',
    ...r.next_actions,
  ].join('\n');
}
