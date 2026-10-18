'use client';

import { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ClipboardCopy, Loader2, MessageCircleWarning, Search, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/lib/operational-toast';
import type { TraceEvent, TraceSummary } from '@/lib/integration/messageTrace';

type Result = {
  ok: true;
  delivery: { id: string; siteOrderId: string; routeId: string | null; completed: boolean };
  summary: TraceSummary;
  events: TraceEvent[];
  sample: { examined: number; limit: number; incomplete: boolean };
};

const SERVER_ORIGIN = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim() || 'https://dfl-entregas.vercel.app').replace(/\/+$/, '');
const eventLabels: Record<string, string> = {
  'delivery.out_for_delivery': 'Saída para entrega',
  'delivery.next_stop': 'Próxima parada',
  'delivery.completed': 'Entrega concluída',
  'delivery.failed': 'Ocorrência na entrega',
};
const tones: Record<TraceSummary['verdict'], string> = {
  site_accepted: 'border-emerald-500/25 bg-emerald-500/[.06] text-emerald-300',
  relay_failed: 'border-red-500/30 bg-red-500/[.07] text-red-300',
  relay_pending: 'border-amber-500/30 bg-amber-500/[.07] text-amber-300',
  no_event: 'border-zinc-700 bg-zinc-800/40 text-zinc-300',
  no_terminal_event: 'border-amber-500/30 bg-amber-500/[.07] text-amber-300',
};

export function MessageTraceCard() {
  const deliveries = useAppStore(state => state.deliveries);
  // Os IDs já estão no store após o boot; selecionar um deles não gera leitura extra.
  const recentSiteDeliveries = useMemo(() => deliveries
    .filter(item => item.source_system === 'dfl_site' && Boolean(item.external_order_id))
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, 8), [deliveries]);
  const [id, setId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const inspect = async () => {
    if (loading) return;
    const query = id.trim().replace(/^#/, '');
    if (query.length < 9) {
      setError('Use o ID inteiro do pedido ou da entrega. O código abreviado não basta.');
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Entre novamente para consultar.');
      const url = Capacitor.isNativePlatform()
        ? `${SERVER_ORIGIN}/api/integration/diagnostic/message-trace`
        : '/api/integration/diagnostic/message-trace';
      const response = await fetch(`${url}?id=${encodeURIComponent(query)}`, {
        headers: { authorization: `Bearer ${await user.getIdToken()}` },
        cache: 'no-store', credentials: 'omit', signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as Result & { error?: string } | null;
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload?.error || `Falha no diagnóstico (HTTP ${response.status}).`);
      }
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar.');
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const lines = [
      'DFL Entregas — rastreio de mensagens (somente leitura)',
      `Pedido Site: ${result.delivery.siteOrderId}`,
      `Entrega: ${result.delivery.id}`,
      `Rota: ${result.delivery.routeId || 'sem rota'}`,
      `Relay: ${result.summary.headline}`,
      `WhatsApp: entrega NÃO verificada`,
      `Amostra: ${result.sample.examined}/${result.sample.limit}${result.sample.incomplete ? ' (limitada)' : ''}`,
      ...result.events.map(event => `${event.eventType} | ${event.status} | tentativas: ${event.attempts} | ${event.lastError || '-'}`),
      'Próxima etapa: conferir intents no Site e worker na VPS, sem reenvio automático.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Rastreio copiado, sem dados do cliente.');
    } catch {
      toast.error('Não foi possível copiar o rastreio.');
    }
  };

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-violet-500/20 bg-zinc-900/60 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><MessageCircleWarning size={21} /></div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-zinc-100">Rastreio do bot por pedido</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Descubra se o Entregas enviou o evento ao Site. Não dispara mensagens nem confirma entrega no WhatsApp.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <label htmlFor="message-trace-order" className="sr-only">ID completo do pedido do Site ou entrega</label>
        <input id="message-trace-order" value={id} onChange={event => { setId(event.target.value); setError(''); setResult(null); }} onKeyDown={event => { if (event.key === 'Enter') void inspect(); }} placeholder="ID completo do pedido ou entrega" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-xs text-zinc-100 outline-none focus:border-violet-500" />
        <button type="button" disabled={loading} onClick={() => void inspect()} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-violet-500 px-3 text-xs font-black text-zinc-950 disabled:opacity-60">
          {loading ? <Loader2 size={15} className="animate-spin"/> : <Search size={15}/>}
          Verificar
        </button>
      </div>
      {recentSiteDeliveries.length > 0 && <div className="mt-3">
        <p className="mb-2 text-[10px] font-semibold text-zinc-400">Pedidos recentes do Site já carregados no aplicativo</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{recentSiteDeliveries.map(item => <button key={item.id} type="button" onClick={() => { setId(item.id); setResult(null); setError(''); }} className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-[10px] font-bold text-zinc-200 active:border-violet-500">#{String(item.external_order_id).slice(-8).toUpperCase()}</button>)}</div>
      </div>}
      <p className="mt-2 text-[10px] text-zinc-500">Consulta manual e limitada, sem polling. Se você só tem o código curto de um pedido antigo, localize o ID inteiro primeiro.</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
      {result && <div className="mt-4 space-y-3">
        <div className={`rounded-xl border p-3 ${tones[result.summary.verdict]}`}>
          <p className="text-sm font-black">{result.summary.headline}</p>
          <p className="mt-1 text-[11px] leading-relaxed opacity-90">{result.summary.detail}</p>
        </div>
        <div className="grid grid-cols-3 gap-2" aria-label="Etapas da comunicação">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5"><p className="text-[9px] font-black uppercase text-zinc-500">1 · Entregas</p><p className="mt-1 text-[11px] font-bold text-zinc-200">{result.events.length ? 'Eventos encontrados' : 'Sem evidência'}</p></div>
          <div className={`rounded-xl border p-2.5 ${result.summary.verdict==='site_accepted'?'border-emerald-500/25 bg-emerald-500/[.06]':'border-zinc-800 bg-zinc-950/60'}`}><p className="text-[9px] font-black uppercase text-zinc-500">2 · Site</p><p className={`mt-1 text-[11px] font-bold ${result.summary.verdict==='site_accepted'?'text-emerald-300':'text-amber-300'}`}>{result.summary.verdict==='site_accepted'?'Evento aceito':result.summary.verdict==='relay_failed'?'Falha no relay':'Conferir fila'}</p></div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[.04] p-2.5"><p className="text-[9px] font-black uppercase text-zinc-500">3 · WhatsApp</p><p className="mt-1 text-[11px] font-bold text-amber-300">Não verificado</p></div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[.04] px-3 py-2 text-[11px] text-amber-300"><ShieldCheck size={15} className="shrink-0"/> Aceite do Site não é comprovante de envio nem de recebimento no WhatsApp.</div>
        <div className="grid grid-cols-3 gap-2 text-center">{[
          ['Site aceitou', result.summary.sent], ['Aguardando', result.summary.pending], ['Com erro', result.summary.failed],
        ].map(([label, count]) => <div key={label} className="rounded-xl bg-zinc-950 p-2"><b className="block text-lg text-zinc-100">{count}</b><span className="text-[9px] text-zinc-500">{label}</span></div>)}</div>
        <div className="space-y-2">{result.events.slice(0, 15).map(event => <div key={event.eventId} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2"><b className="truncate text-[11px] text-zinc-200">{eventLabels[event.eventType] || event.eventType}</b><span className="shrink-0 rounded-md bg-zinc-800 px-2 py-1 text-[9px] font-bold text-zinc-300">{event.status}</span></div>
          <p className="mt-1 text-[10px] text-zinc-500">{event.attempts} tentativa(s) · {event.occurredAt || 'sem horário'}</p>
          {event.lastError && <p className="mt-1 break-words text-[10px] text-red-300">{event.lastError}</p>}
        </div>)}</div>
        {result.sample.incomplete && <p className="text-[10px] text-amber-300">Consulta atingiu o limite de {result.sample.limit} eventos; resultados podem estar incompletos.</p>}
        <button type="button" onClick={() => void copy()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 text-xs font-black text-violet-300"><ClipboardCopy size={16}/> Copiar diagnóstico para investigar Site/VPS</button>
      </div>}
    </section>
  );
}
