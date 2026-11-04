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
  const checks: CertificationCheck[]=[
    {id:'A',status:ledger&&accepted?'ok':'attention',title:'Eventos confirmados',detail:ledger&&accepted?'Há evidências persistidas no servidor.':'Falta comprovar aceite ou histórico de eventos.'},
    {id:'B',status:projectionValid?'ok':'attention',title:'Projeção pública sanitizada',detail:projectionValid?'Contrato B estruturalmente válido.':'Dados insuficientes para uma projeção validada.'},
    {id:'C',status:'off',title:'Acesso protegido',detail:'Links e sessões públicas não são certificados por esta inspeção.'},
    {id:'D',status:'off',title:'Mensageria seletiva',detail:'Nenhuma mensagem é enviada pelo laboratório.'},
    {id:'E',status:s.gate.kill_switch||s.gate.mode==='OFF'?'ok':'attention',title:'Configuração conservadora',detail:s.gate.kill_switch||s.gate.mode==='OFF'?'Proteções OFF/kill-switch registradas.':'Revisar configuração antes de qualquer homologação externa.'},
  ];
  return {contract:'dfl.tracking.gate2.certificate',version:1,source:'confirmed_server_snapshot',canonical_order_key:s.delivery.canonical_order_key,
    checks,operational_review:blocking?'blocked':'reviewable',public_activated:false,messages_sent:false,
    checked_at:s.readiness.last_confirmed_at,evidence_count:e.length,public_projection_valid:projectionValid};
}
