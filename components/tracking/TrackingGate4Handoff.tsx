'use client';
import { CheckCircle2, CircleHelp, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Gate4Handoff } from '@/lib/tracking/gate4/handoff';

const yes=(v:boolean)=>v?'Configurado':'Pendente';
export function TrackingGate4Handoff({report}:{report:Gate4Handoff}){
  const fields=[
    ['Núcleo técnico',report.code_enabled],
    ['Identidade da empresa',report.tenant_configured],
    ['Chaves servidor-servidor',report.s2s_keyset_configured],
    ['Certificação de acesso externo',report.customer_access_certified],
  ] as const;
  return <section className="space-y-3" aria-label="Verificação administrativa da ponte">
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[.045] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-zinc-100"><ShieldCheck size={17} className="text-cyan-300"/> Contrato A–E · leitura protegida</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">Este relatório avalia configurações e contratos, mas não faz prova de conectividade com o Site. Não emite links, não envia mensagens e não ativa funcionalidades.</p>
    </div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{fields.map(([label,enabled])=><div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-3"><div className="flex items-center gap-2 text-xs font-bold text-zinc-200">{enabled?<CheckCircle2 size={15} className="text-emerald-300"/>:<CircleHelp size={15} className="text-amber-300"/>}{label}</div><p className="mt-1 pl-6 text-[11px] text-zinc-500">{yes(enabled)}</p></div>)}</div>
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
      <div className="flex items-center gap-2"><LockKeyhole size={16} className="text-zinc-400"/><p className="text-xs font-black text-zinc-100">Proteções por empresa</p></div>
      <p className="mt-2 text-xs text-zinc-400">Modo: <strong className="text-zinc-200">{report.company_mode}</strong> · Bloqueio emergencial: <strong className="text-zinc-200">{report.kill_switch?'ativo':'inativo'}</strong></p>
      <p className="mt-1 text-xs text-zinc-500">Disponibilização externa: <strong className="text-zinc-300">{report.integration_status==='off'?'Desligada':'Exige homologação conjunta'}</strong></p>
    </div>
    <div className="space-y-2">{report.checks.map(c=><div key={c.id} className="flex gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/35 p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-black text-zinc-200">{c.id}</div><div className="min-w-0"><p className="text-xs font-bold text-zinc-100">{c.label} <span className="font-normal text-zinc-500">· {c.state==='off'?'OFF':c.state==='defined'?'Contrato definido':'Em revisão'}</span></p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{c.note}</p></div></div>)}</div>
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-3"><p className="flex items-center gap-2 text-xs font-black text-amber-200"><ShieldAlert size={16}/> Sem ativação pública</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">A implementação da página /acompanhar e os testes com sessões reais dependem do Site. Não confundir configuração interna com autorização para enviar links.</p></div>
  </section>;
}
