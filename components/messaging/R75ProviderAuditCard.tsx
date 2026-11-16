'use client';
/** Read-only owner diagnostics: deliberately no resubmit / retry / new tracking grant CTA. */
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { r75AuditDisposition, type R75AuditView } from '@/lib/integration/messagingAuditPolicyR75';

const names: Record<string,string> = {
  'order.created':'Pedido cadastrado', 'order.production':'Preparação', 'order.ready':'Pronto para retirada',
  'delivery.started':'Saiu para entrega', 'delivery.next_stop':'Próxima parada',
  'delivery.completed':'Concluído', 'order.cancelled':'Cancelamento', 'delivery.failed':'Ocorrência',
};
export function R75ProviderAuditCard({ audit }: { audit: R75AuditView }) {
  return <section aria-label="Auditoria real dos avisos WhatsApp" className="rounded-2xl border border-zinc-700/75 bg-zinc-950/80 p-3.5">
    <div className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-amber-300"/>
      <div><h3 className="text-xs font-black text-zinc-100">Fila WhatsApp · resultado real</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Consulta protegida no Supabase, por pedido. Nenhuma consulta dispara mensagens.</p></div>
    </div>
    {audit.status !== 'ok' ? <p role="status" className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] text-amber-200">
      {audit.status === 'not_applicable' ? 'Esta origem não usa a fila manual auditada.' : audit.status === 'not_configured' ? 'Ponte de auditoria não configurada. Não significa que as mensagens falharam.' : 'Auditoria indisponível nesta consulta. Não reenviar com base nesta ausência de resposta.'}
    </p> : <>
      {audit.records.length === 0 ? <p className="mt-3 rounded-xl bg-zinc-900/70 p-3 text-[11px] text-zinc-400">Nenhum registro encontrado para o pedido na fila manual. Isso não comprova que o cliente não recebeu avisos.</p> :
        <div className="mt-3 space-y-2">{audit.records.map((r,i)=>{
          const d=r75AuditDisposition(r);
          return <article key={`${r.fingerprint}-${i}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="flex items-center gap-2">{d.requiresReview?<AlertTriangle size={15} className="shrink-0 text-amber-300"/>:r.state==='sent'?<CheckCircle2 size={15} className="shrink-0 text-emerald-300"/>:<Clock3 size={15} className="shrink-0 text-sky-300"/>}
              <strong className="flex-1 text-[11px] text-zinc-100">{names[r.eventType]||r.eventType.replace(/[_\.]/g,' ')}</strong>
              <span className="text-[10px] font-bold text-zinc-300">{d.title}</span></div>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">{d.note}</p>
            {r.failureCode && <p className="mt-1 text-[10px] text-amber-200">Código: {r.failureCode}</p>}
            {r.createdAt && <p className="mt-1 text-[10px] text-zinc-500">Evento: {new Date(r.createdAt).toLocaleString('pt-BR')}</p>}
          </article>;
        })}</div>}
      {audit.sampleLimited && <p className="mt-2 text-[10px] text-amber-200">Amostra limitada a 24 eventos; não é o histórico completo.</p>}
    </>}
    <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Retirada retida ou link com envio incerto exigem revisão individual. Nunca repetir automaticamente, mesmo após a VPS reconectar. Link privado e mensagem do pedido são fluxos independentes.</p>
  </section>;
}
