'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShieldCheck, MessageSquareText, Settings2, ChevronDown, Truck, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { MessagingOrderPicker } from '@/components/messaging/MessagingOrderPicker';

type Reason = 'delivery_not_found' | string;
type Diagnostics = {
  ok: boolean;
  checkedAt: string;
  gates: {
    manualEnabled: boolean; manualActivationValid: boolean; manualSiteTargetConfigured: boolean;
    reverseRelayEnabled: boolean; reverseRelayConfigured: boolean;
  };
  reverseOutbox: Record<string, number>;
  issues: Array<{eventType:string;status:string;attempts:number;updatedAt:string;
    failure:{code:string;detail:string;retryable:boolean}}>;
  delivery: null | { present: boolean; created: Reason; routeStarted: Reason; completed: Reason; createdAfterActivation: boolean; sendingPermitted: boolean };
  note: string;
};
const reasonLabels: Record<string, string> = {
  eligible_by_policy: 'Apto pelas regras', delivery_not_found: 'Pedido não encontrado',
  delivery_id_invalid: 'Identificador inválido', source_not_manual: 'Pedido do Site ou marketplace',
  no_explicit_opt_in: 'Cliente não autorizou o WhatsApp', test_or_internal_order: 'Pedido interno/teste',
  not_dfl_delivery: 'Não é uma entrega DFL', phone_missing_or_invalid: 'Telefone ausente ou inválido',
  creation_not_current: 'Fora da janela de criação', route_not_recently_started: 'Rota ainda não iniciou ou saiu da janela',
  completion_not_current: 'Entrega ainda não concluída ou fora da janela',
};
function Gate({ title, yes, subtitle }: { title: string; yes: boolean; subtitle: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/75 p-3">
    <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
      {yes ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-amber-400" />}{title}
    </div>
    <p className="mt-1 text-[11px] text-zinc-400">{subtitle}</p>
  </div>;
}
export default function MensageriaDiagnosticPage() {
  const router = useRouter();
  const isOwner = isSuperadminUid(useAppStore(s => s.user?.uid));
  const deliveries = useAppStore(s => s.deliveries);
  const [deliveryId, setDeliveryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Diagnostics | null>(null);
  const consult = async () => {
    if (!isOwner || busy) return;
    setBusy(true); setError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão indisponível. Entre novamente.');
      const token = await user.getIdToken();
      const serverOrigin = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim() || 'https://dfl-entregas.vercel.app').replace(/\/+$/, '');
      const origin = Capacitor.isNativePlatform() ? serverOrigin : '';
      const id = deliveryId.trim();
      const url = `${origin}/api/integration/messaging-diagnostics${id ? `?deliveryId=${encodeURIComponent(id)}` : ''}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => null) as Diagnostics | null;
      if (!response.ok || !body?.ok || !body.gates) throw new Error('Não foi possível consultar os diagnósticos.');
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'AbortError'
        ? 'Tempo esgotado. A consulta anterior foi preservada.'
        : cause instanceof Error ? cause.message : 'Falha ao consultar.');
    } finally { window.clearTimeout(timer); setBusy(false); }
  };
  const pending = (data?.reverseOutbox.pending ?? 0)+(data?.reverseOutbox.processing ?? 0);
  const failures = (data?.reverseOutbox.failed ?? 0)+(data?.reverseOutbox.dead_letter ?? 0);
  const reverseReady = Boolean(data?.gates.reverseRelayEnabled && data?.gates.reverseRelayConfigured);
  const highPriority = data?.issues.filter(item=>item.status==='failed'||item.status==='dead_letter') ?? [];

  return <div className="dfl-page mx-auto max-w-3xl space-y-3 pb-24 text-zinc-100">
    <header className="relative overflow-hidden rounded-[26px] border border-amber-400/20 bg-gradient-to-br from-[#252015] via-[#171a1d] to-zinc-950 px-4 py-5 shadow-[0_18px_40px_rgba(0,0,0,.22)]">
      <button type="button" onClick={() => router.push('/mais')} className="mb-4 flex min-h-10 items-center gap-2 text-xs text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><ArrowLeft size={16}/> Voltar</button>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-amber-300"><MessageSquareText size={16}/> DFL 360 · Operação</div>
      <h1 className="font-heading text-[24px] font-black leading-tight tracking-tight">Central de Mensageria</h1>
      <p className="mt-2 max-w-lg text-xs leading-relaxed text-zinc-400">Acompanhe o fluxo das notificações e identifique falhas na ponte logística, sem abrir várias telas técnicas.</p>
      {isOwner && <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void consult()} disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-black text-zinc-950 transition-transform active:scale-[.99] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><RefreshCw size={16} className={busy?'animate-spin':''}/>{busy ? 'Atualizando…' : data ? 'Atualizar panorama' : 'Consultar panorama'}</button>
        <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-3 text-[10px] font-bold text-zinc-300"><ShieldCheck size={14} className="text-emerald-400"/> Consulta protegida</span>
      </div>}
      {data && <p role="status" className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500"><Clock3 size={13}/> Atualizado: {new Date(data.checkedAt).toLocaleString('pt-BR')}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
    </header>

    {!isOwner ? <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200"><LockKeyhole size={17} className="inline"/> Somente o superadministrador pode consultar a mensageria.</p> : <>
      <section aria-label="Indicadores da integração" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5"><Clock3 size={16} className="mb-2 text-amber-300"/><strong className="block text-2xl font-black tabular-nums">{data?pending:'—'}</strong><p className="mt-1 text-[10px] text-zinc-400">Em andamento</p></div>
        <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5"><AlertTriangle size={16} className="mb-2 text-rose-300"/><strong className="block text-2xl font-black tabular-nums">{data?failures:'—'}</strong><p className="mt-1 text-[10px] text-zinc-400">Falhas da ponte</p></div>
        <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5"><Truck size={16} className="mb-2 text-emerald-300"/><strong className="block text-sm font-black">{data?(reverseReady?'Conectada':'Verificar'):'—'}</strong><p className="mt-1 text-[10px] text-zinc-400">Logística → Site</p></div>
        <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5"><ShieldCheck size={16} className="mb-2 text-sky-300"/><strong className="block text-sm font-black">{data?(data.gates.manualEnabled?'Habilitado':'OFF'):'—'}</strong><p className="mt-1 text-[10px] text-zinc-400">Avisos manuais</p></div>
      </section>

      <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-sm font-black">Saúde da operação</h2><p className="mt-1 text-[11px] text-zinc-500">Visão compacta da fila logística</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${data&&reverseReady?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>{data&&reverseReady?'Ponte configurada':'Conferir'}</span></div>
        <div className="mt-3 rounded-xl bg-zinc-950/70 p-3 text-[11px] leading-relaxed text-zinc-400">
          {data ? failures>0 ? `Há ${failures} evento(s) com falha na outbox logística. Veja os motivos abaixo antes de reprocessar.` : pending>0 ? `Há ${pending} evento(s) aguardando ou em processamento na ponte.` : 'Nenhuma pendência detectada nas categorias monitoradas da ponte.' : 'Toque em “Consultar panorama” para carregar informações reais do servidor.'}
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">Piloto de mensagens e links privados de acompanhamento são funções diferentes. Aceite na fila não confirma recebimento pelo WhatsApp.</p>
      </section>

      {data && <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="font-heading text-sm font-black">Últimas falhas da ponte</h2><p className="mt-1 text-[11px] text-zinc-500">Motivo antes de qualquer nova tentativa</p></div><span className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400">12 eventos máx.</span></div>
        {highPriority.length===0 ? <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-xs text-zinc-400">Sem falhas recentes na amostra. Eventos aceitos na fila não equivalem a mensagens entregues.</div> : <div className="space-y-2">{highPriority.map((issue,index)=><article key={`${issue.eventType}-${index}`} className="rounded-xl border border-rose-400/15 bg-zinc-950/70 p-3">
          <div className="flex items-center justify-between gap-2"><strong className="min-w-0 truncate text-xs text-zinc-100">{issue.eventType.replace(/[_\.]/g,' ')}</strong><span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300">{issue.status==='dead_letter'?'Bloqueada':'Falhou'}</span></div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-300">{issue.failure.detail}</p>
          <p className="mt-1 text-[10px] text-zinc-500">{issue.attempts} tentativa(s) automáticas · {issue.failure.retryable?'Possível falha temporária.':'Revisão técnica necessária.'}</p>
        </article>)}</div>}
        <p className="mt-3 text-[10px] text-amber-200">Não existe botão de repetição em massa. Erros impeditivos exigem correção, não mais tentativas.</p>
      </section>}

      <details className="group overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-900/50">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-bold text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><Settings2 size={17} className="text-amber-300"/> Ferramentas avançadas</span><span className="flex items-center gap-1 text-[10px] font-medium text-zinc-500">Diagnóstico e homologação <ChevronDown size={15} className="transition-transform group-open:rotate-180"/></span></summary>
        <div className="space-y-3 border-t border-zinc-800 px-4 pb-4 pt-3">
          <p className="text-[11px] leading-relaxed text-zinc-400">A consulta de pedido e os testes de autenticação ficam separados do acompanhamento diário. Nenhuma consulta dispara mensagens.</p>
          <MessagingOrderPicker deliveries={deliveries} selectedId={deliveryId} onSelect={setDeliveryId} />
          {data && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Gate title="Avisos manuais" yes={data.gates.manualEnabled} subtitle={data.gates.manualEnabled?'Habilitados pelo servidor':'Desativados. Sem disparo para clientes.'}/>
            <Gate title="Janela de ativação" yes={data.gates.manualActivationValid} subtitle="Pedidos antigos ficam excluídos."/>
            <Gate title="Destino manual do Site" yes={data.gates.manualSiteTargetConfigured} subtitle="Configuração presente, sem expor segredos."/>
            <Gate title="Ponte logística" yes={reverseReady} subtitle="Integração reversa e assinatura do Site."/>
          </div>}
          <label htmlFor="dfl-m4-id" className="block text-xs font-bold text-zinc-200">ID interno (alternativa para pedido não encontrado na lista)</label>
          <input id="dfl-m4-id" type="text" autoComplete="off" spellCheck={false} value={deliveryId} onChange={event => setDeliveryId(event.target.value.slice(0,128))} placeholder="dfl-..." className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"/>
          <button type="button" onClick={() => void consult()} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-100 disabled:opacity-50"><RefreshCw size={15}/>{busy?'Consultando…':'Verificar pontes e pedido'}</button>
          {data?.delivery && <div className="rounded-xl bg-zinc-950 p-3">
            <h3 className="text-xs font-bold text-zinc-100">Elegibilidade do pedido consultado</h3>
            {!data.delivery.present ? <p className="mt-2 text-xs text-amber-300">Pedido não encontrado.</p> : <><p className="mt-2 text-[11px] text-zinc-400">Criado após ativação: {data.delivery.createdAfterActivation?'Sim':'Não'}</p>
              <div className="mt-2 space-y-2">{([['Cadastro',data.delivery.created],['Saída da rota',data.delivery.routeStarted],['Conclusão',data.delivery.completed]] as const).map(([title,value])=><div key={title} className="flex justify-between gap-3 rounded-lg bg-zinc-900 p-2.5 text-[11px]"><strong>{title}</strong><span className="text-right text-zinc-400">{reasonLabels[value]||value.replace(/_/g,' ')}</span></div>)}</div>
            </>}
          </div>}
          {data && <details className="rounded-xl border border-zinc-800 bg-zinc-950/70"><summary className="min-h-11 cursor-pointer p-3 text-xs font-bold text-zinc-300">Todos os estados da outbox</summary><div className="grid grid-cols-2 gap-2 px-3 pb-3 text-[10px] text-zinc-400">{['pending','processing','failed','dead_letter'].map(key=><div key={key} className="rounded-lg bg-zinc-900 p-2">{key}: {data.reverseOutbox[key]??0}</div>)}</div></details>}
          <button type="button" onClick={() => router.push('/mais/mensageria/homologacao')} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 text-left text-xs font-bold text-amber-200"><span className="flex items-center gap-2"><ShieldCheck size={16}/> Homologação técnica do bot</span><span>›</span></button>
          <p className="text-[10px] text-zinc-500">Teste protegido, sem envio em massa. Histórico de homologação preservado para auditoria.</p>
        </div>
      </details>
      <p className="px-1 text-[10px] leading-relaxed text-zinc-500">Esta central não expõe telefone completo, conteúdo das mensagens, segredos ou dados financeiros. Aceito na fila não equivale a recebido pelo cliente.</p>
    </>}
  </div>;
}
