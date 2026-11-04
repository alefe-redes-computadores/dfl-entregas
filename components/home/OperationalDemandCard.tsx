'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, Clock3, ShieldAlert, Users } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { latestSuccessfulSyncDiagnostic, latestSyncDiagnostic, SYNC_DIAGNOSTIC_EVENT } from '@/lib/sync-diagnostics';
import { deriveOperationalDemand, observedDemandLevel, stabilizeDemandLevel, type DemandStability } from '@/lib/operation/operational-demand-signal';

/** R246: painel local, progressivo e sem efeitos operacionais. NÃO informa disponibilidade ao Site. */
export function OperationalDemandCard() {
  const deliveries = useAppStore(s => s.deliveries);
  const routes = useAppStore(s => s.routes);
  const motoboys = useAppStore(s => s.motoboys);
  const localOpen = useAppStore(s => s.storeSettings.isOpen);
  const syncError = useAppStore(s => s.syncError);
  const [nowMs, setNowMs] = useState(0);
  const [online, setOnline] = useState(true);
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null);
  const [recentFailure, setRecentFailure] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [override, setOverride] = useState<'automatic' | 'review' | 'high'>('automatic');
  const [stability, setStability] = useState<DemandStability | null>(null);

  useEffect(() => {
    const refresh = () => {
      setNowMs(Date.now());
      setOnline(navigator.onLine);
      const success = latestSuccessfulSyncDiagnostic();
      const recent = latestSyncDiagnostic();
      const time = success?.finishedAt ? Date.parse(success.finishedAt) : NaN;
      setLastSyncMs(Number.isFinite(time) ? time : null);
      setRecentFailure(recent?.status === 'error');
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener(SYNC_DIAGNOSTIC_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener(SYNC_DIAGNOSTIC_EVENT, refresh);
    };
  }, []);
  const signal = useMemo(() => deriveOperationalDemand({
    nowMs, lastSuccessfulSyncMs: lastSyncMs, online,
    lastSyncFailed: recentFailure || syncError, localOperationOpen: localOpen,
    deliveries, routes, motoboys,
  }), [nowMs, lastSyncMs, online, recentFailure, syncError, localOpen, deliveries, routes, motoboys]);
  useEffect(() => { setStability(previous => stabilizeDemandLevel(previous, signal.level, nowMs)); }, [signal.level, nowMs]);
  const stableLevel = stability && signal.freshness === 'fresh' ? stability.level : 'unknown';
  const level = observedDemandLevel(stableLevel, override, signal.freshness);
  const labels = {
    unknown: ['Sem sinal confiável', 'text-zinc-300', 'border-zinc-700/70'],
    normal: ['Sem alerta quantitativo', 'text-emerald-300', 'border-emerald-500/25'],
    attention: ['Revisão recomendada', 'text-amber-300', 'border-amber-500/30'],
    high: ['Pressão elevada', 'text-rose-300', 'border-rose-500/30'],
  } as const;
  const label = labels[level];
  return (
    <section aria-label="Pressão operacional observada, não pública" className={`rounded-[22px] border bg-gradient-to-br from-zinc-900/85 to-zinc-950 p-3.5 ${label[2]}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-700/70 bg-zinc-950/60 text-amber-300"><Activity size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-zinc-500">Agora · leitura interna</p>
          <p className={`text-[12px] font-black ${label[1]}`}>{label[0]}</p>
          <p className="truncate text-[10px] text-zinc-500">{signal.freshness === 'fresh' ? `${signal.queue} na fila · ${signal.preparing} em preparo · ${signal.driversActive} motoboys ativos` : signal.reason}</p>
        </div>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="dfl-r246-demand-detail" aria-label={expanded ? 'Recolher detalhes de demanda' : 'Expandir detalhes de demanda'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-400 active:bg-zinc-800"><ChevronDown size={17} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
      </div>
      {expanded && <div id="dfl-r246-demand-detail" className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
        <p className="text-xs leading-relaxed text-zinc-300">{signal.reason}</p>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="rounded-xl bg-zinc-950/70 p-2"><strong className="block text-lg text-zinc-100">{signal.queue}</strong><span className="text-zinc-500">Sem rota</span></div>
          <div className="rounded-xl bg-zinc-950/70 p-2"><strong className="block text-lg text-zinc-100">{signal.preparing}</strong><span className="text-zinc-500">Em preparo</span></div>
          <div className="rounded-xl bg-zinc-950/70 p-2"><strong className="block text-lg text-zinc-100">{signal.driversFree}</strong><span className="text-zinc-500">Sem rota na rua*</span></div>
        </div>
        <p className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Users size={13} /> {signal.routeAssembly} rotas em montagem · {signal.routesOnStreet} na rua · {signal.pendingCommercial} aguardando confirmação comercial</p>
        <p className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Clock3 size={13} /> Sincronização: {signal.freshness === 'fresh' ? 'recente' : signal.freshness} · amostra de {signal.sampledOrders} pedidos nas últimas 2h · confiança {signal.confidence}</p>
        {(signal.futureScheduled > 0 || signal.conflictingIdentities > 0 || signal.driverAssignmentUnknown > 0) && <p className="text-[10px] text-amber-300">{signal.futureScheduled} agendados futuros fora da fila · {signal.conflictingIdentities} identidades conflitantes · {signal.driverAssignmentUnknown} atribuições não confirmadas</p>}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="r246-override" className="text-[10px] font-bold text-zinc-400">Revisão manual (somente nesta tela)</label>
          <select id="r246-override" value={override} onChange={event => setOverride(event.target.value as 'automatic' | 'review' | 'high')} className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200">
            <option value="automatic">Automático</option>
            <option value="review">Exigir revisão</option>
            <option value="high">Marcar atenção alta</option>
          </select>
        </div>
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-zinc-500"><ShieldAlert size={13} className="mt-0.5 shrink-0" /> *Motoboy sem rota na rua não equivale a motoboy disponível. Este painel não confirma se o Site está aberto, não calcula ETA, não envia mensagens, não muda pedidos e não publica sinal de demanda.</p>
      </div>}
    </section>
  );
}
