/** Gate2 owner-only evidence summary. Pure, read-only, no secrets, no grants. */
import type { TrackingInspection } from '../gate1/readiness';
import { validatePublicProjection } from '../gate1/core';

export type CertificationCheck = {id:'A'|'B'|'C'|'D'|'E';status:'ok'|'attention'|'off';title:string;detail:string};
export type Gate2Certificate = {
  contract:'dfl.tracking.gate2.certificate';version:1;source:'confirmed_server_snapshot';
  canonical_order_key:string;checks:CertificationCheck[];
  operational_review:'reviewable'|'blocked';public_activated:false;messages_sent:false;
  checked_at:string|null; evidence_count:number;public_projection_valid:boolean;
};
export function certifyInspection(s:TrackingInspection):Gate2Certificate {
  const e=s.events||[];
  const ledger=Boolean(e.length&&e.every(v=>v.id&&v.kind&&v.at));
  const projectionValid=Boolean(s.public_projection&&validatePublicProjection(s.public_projection));
  const accepted=!s.readiness.signals.some(v=>v.code==='NOT_ACCEPTED');
  const blocking=s.readiness.signals.some(v=>v.severity==='blocker');
  const linkConfigured=s.gate.code_enabled&&s.gate.customer_access_certified&&!s.gate.kill_switch&&s.gate.public_tracking&&s.gate.issue_tracking_link&&s.gate.origin_eligible&&['MANUAL','AUTOMATIC_CERTIFIED'].includes(s.gate.mode);
  const checks: CertificationCheck[]=[
    {id:'A',status:ledger&&accepted?'ok':'attention',title:'Eventos confirmados',detail:ledger&&accepted?'Há evidências persistidas no servidor.':'Falta comprovar aceite ou histórico de eventos.'},
    {id:'B',status:projectionValid?'ok':'attention',title:'Projeção pública sanitizada',detail:projectionValid?'Contrato B estruturalmente válido.':'Dados insuficientes para uma projeção validada.'},
    {id:'C',status:linkConfigured?'attention':'off',title:'Acesso protegido',detail:linkConfigured?'Configuração de link presente; este teste não valida emissão ou sessão real. Confira o pedido na área Acesso privado.':'Link não habilitado nesta configuração. Isso é independente do piloto WhatsApp.'},
    {id:'D',status:'off',title:'Mensageria seletiva',detail:'Este laboratório não envia mensagens. O piloto WhatsApp é verificado separadamente na Mensageria.'},
    {id:'E',status:s.gate.kill_switch||s.gate.mode==='OFF'?'ok':'attention',title:'Configuração conservadora',detail:s.gate.kill_switch||s.gate.mode==='OFF'?'Proteções OFF/kill-switch registradas.':'Modo ativo nesta empresa; a emissão exige regras e aceite por pedido.'},
  ];
  return {contract:'dfl.tracking.gate2.certificate',version:1,source:'confirmed_server_snapshot',canonical_order_key:s.delivery.canonical_order_key,
    checks,operational_review:blocking?'blocked':'reviewable',public_activated:false,messages_sent:false,
    checked_at:s.readiness.last_confirmed_at,evidence_count:e.length,public_projection_valid:projectionValid};
}
