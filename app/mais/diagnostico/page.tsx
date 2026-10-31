'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Activity, BellRing, ChevronLeft, Clipboard, Database, RefreshCw, RotateCcw, Send, Trash2 } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { ReportMaintenanceCard } from '@/components/reports/ReportMaintenanceCard';
import {
  clearSyncDiagnostics,
  readSyncDiagnostics,
  syncDiagnosticText,
  summarizeSyncHealth,
  SYNC_DIAGNOSTIC_EVENT,
  type SyncDiagnostic,
} from '@/lib/sync-diagnostics';
import { auth } from '@/lib/firebase';
import { rankSyncCollectionVolumes } from '@/lib/operation/sync-volume-ranking';
import { ACTION_LATENCY_EVENT, actionLatencyDiagnosticText, clearActionLatencies, readActionLatencies, summarizeActionLatencies, type ActionLatencySample } from '@/lib/operation/action-latency';
import { MessageTraceCard } from '@/components/diagnostics/MessageTraceCard';
import { LegacyImportAuditCard } from '@/components/diagnostics/LegacyImportAuditCard'; // DFL_R202_LEGACY_AUDIT

const DIAGNOSTICS_ADMIN_EMAIL = 'alefejohsefe@gmail.com';
const SERVER_ORIGIN = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim() || 'https://dfl-entregas.vercel.app').replace(/\/+$/, '');

type RecoveryIssue = {
  eventId: string; eventType: string; entityId: string; routeId: string;
  status: string; attempts: number; occurredAt: string; updatedAt: string;
  nextAttemptAt: string | null; lastError: string | null;
};

const dateTime = (value: string) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(parsed);
};

export default function OperationalDiagnosticsPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const initData = useAppStore((state) => state.initData);
  const isSyncing = useAppStore((state) => state.isSyncing);
  const syncError = useAppStore((state) => state.syncError);
  const [syncChecking, setSyncChecking] = useState(false);
  const syncClickLockRef = useRef(false);
  const recoveryClickLockRef = useRef(false);
  const [entries, setEntries] = useState<SyncDiagnostic[]>([]);
  const [latencies, setLatencies] = useState<ActionLatencySample[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<number | null>(null);
  const [pendingPreview, setPendingPreview] = useState<
    Array<{ id: number; title: string; at?: string }>
  >([]);
  const [recovery, setRecovery] = useState<{ stats: Record<string, number>; issues: RecoveryIssue[] } | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState('');
  const isAdmin = user?.email?.trim().toLowerCase() === DIAGNOSTICS_ADMIN_EMAIL;

  // Dados do relay são da sessão que os consultou; trocar o Google limpa a prévia.
  useEffect(() => { setRecovery(null); }, [user?.uid]);

  useEffect(() => {
    if (user && !isAdmin) router.replace('/mais');
  }, [isAdmin, router, user]);

  useEffect(() => {
    setEntries(readSyncDiagnostics());
    setLatencies(readActionLatencies());
    if (!Capacitor.isNativePlatform()) return;
    void LocalNotifications.getPending()
      .then((result) => {
        setPendingNotifications(result.notifications.length);
        setPendingPreview(
          result.notifications.slice(0, 8).map((item) => ({
            id: item.id,
            title: item.title || 'Notificação operacional',
            at: item.schedule?.at
              ? new Date(item.schedule.at).toISOString()
              : undefined,
          })),
        );
      })
      .catch(() => setPendingNotifications(null));
  }, []);

  const summary = useMemo(() => {
    const successes = entries.filter((entry) => entry.status === 'success');
    const total = successes.reduce((sum, entry) => sum + entry.totalDocuments, 0);
    const repeatedHighVolume = successes
      .slice(0, 3)
      .filter((entry) => entry.totalDocuments >= 300).length >= 2;
    return {
      last: entries[0],
      total,
      errors: entries.filter((entry) => entry.status === 'error').length,
      repeatedHighVolume,
    };
  }, [entries]);

  const localHealth = useMemo(() => summarizeSyncHealth(entries), [entries]);
  const collectionHotspots = useMemo(() => rankSyncCollectionVolumes(entries), [entries]);
  const actionLatencyGroups = useMemo(() => summarizeActionLatencies(latencies), [latencies]);
  useEffect(() => {
    const refreshLatency = () => setLatencies(readActionLatencies());
    window.addEventListener(ACTION_LATENCY_EVENT, refreshLatency);
    return () => window.removeEventListener(ACTION_LATENCY_EVENT, refreshLatency);
  }, []);

  // A tela aberta acompanha novos diagnósticos sem polling nem fetch adicional.
  useEffect(() => {
    const onRecorded = () => setEntries(readSyncDiagnostics());
    window.addEventListener(SYNC_DIAGNOSTIC_EVENT, onRecorded);
    return () => window.removeEventListener(SYNC_DIAGNOSTIC_EVENT, onRecorded);
  }, []);

  const recoveryUrl = Capacitor.isNativePlatform()
    ? `${SERVER_ORIGIN}/api/integration/diagnostics`
    : '/api/integration/diagnostics';

  const loadRecovery = async (fromRetry = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (recoveryClickLockRef.current && !fromRetry) return;
    if (!fromRetry) {
      recoveryClickLockRef.current = true;
      setRecoveryBusy('loading');
    }
    try {
      const response = await fetch(recoveryUrl, {
        headers: { authorization: `Bearer ${await currentUser.getIdToken()}` },
        cache: 'no-store', credentials: 'omit',
      });
      const payload = await response.json();
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || 'Falha no diagnostico remoto.');
      // Another Google account may have signed in before the request finished.
      if (auth.currentUser?.uid !== currentUser.uid) return;
      setRecovery({ stats: payload.stats || {}, issues: Array.isArray(payload.issues) ? payload.issues : [] });
    } catch (error) {
      if (auth.currentUser?.uid !== currentUser.uid) return;
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel consultar a recuperacao.');
    } finally {
      if (!fromRetry) {
        setRecoveryBusy('');
        recoveryClickLockRef.current = false;
      }
    }
  };

  const retryEvent = async (eventId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || recoveryBusy || recoveryClickLockRef.current) return;
    recoveryClickLockRef.current = true;
    setRecoveryBusy(eventId);
    toast.loading('Reprocessando somente este evento...', { id: 'recovery-event' });
    try {
      const response = await fetch(recoveryUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${await currentUser.getIdToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ eventId }), cache: 'no-store', credentials: 'omit',
      });
      const payload = await response.json();
      if (auth.currentUser?.uid !== currentUser.uid) return;
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || payload.relay?.results?.[0]?.error || 'Evento ainda nao foi enviado.');
      toast.success('Site aceitou o evento. WhatsApp não verificado.', { id: 'recovery-event' });
      await loadRecovery(true);
      if (auth.currentUser?.uid !== currentUser.uid) return;
      await initData();
      if (auth.currentUser?.uid === currentUser.uid) setEntries(readSyncDiagnostics());
    } catch (error) {
      if (auth.currentUser?.uid !== currentUser.uid) return;
      toast.error('Reprocessamento nao concluido.', { id: 'recovery-event', description: error instanceof Error ? error.message : undefined });
    } finally {
      setRecoveryBusy('');
      recoveryClickLockRef.current = false;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(syncDiagnosticText(entries) + '\n\n' + actionLatencyDiagnosticText(latencies));
      toast.success('Diagnóstico copiado.');
    } catch {
      toast.error('Não foi possível copiar o diagnóstico.');
    }
  };

  const clear = () => {
    clearSyncDiagnostics();
    clearActionLatencies();
    setEntries([]);
    setLatencies([]);
    toast.success('Histórico local apagado.');
  };

  const handleSync = async () => {
    if (syncClickLockRef.current || isSyncing || syncChecking) {
      toast.info('A sincronização já está em andamento.', { id: 'sync-toast' });
      return;
    }
    syncClickLockRef.current = true;
    setSyncChecking(true);
    const before = readSyncDiagnostics()[0]?.id;
    toast.loading('Sincronizando com a nuvem...', { id: 'sync-toast' });
    try {
      await initData();
      const updated = readSyncDiagnostics();
      const last = updated[0];
      setEntries(updated);
      // initData returns early without running when hydration has not completed.
      // A skipped run must never be called a successful synchronization.
      if (!last || last.id === before) {
        toast.warning('Sincronização não iniciada.', { id: 'sync-toast', description: 'Confira a inicialização da sessão e tente novamente.' });
      } else if (last.status === 'error' || useAppStore.getState().syncError) {
        toast.error('Falha na sincronização', { id: 'sync-toast', description: 'Confira sua internet e o diagnóstico local.' });
      } else {
        toast.success('Sincronização concluída', { id: 'sync-toast', description: 'Os dados recebidos foram conciliados com a nuvem.' });
      }
    } catch {
      toast.error('Não foi possível sincronizar', { id: 'sync-toast' });
    } finally {
      setSyncChecking(false);
      syncClickLockRef.current = false;
    }
  };

  if (!user || !isAdmin) return null;

  return (
    <div className="pb-28">
      <header className="mb-5 flex items-center gap-3">
        <button type="button" onClick={() => router.replace('/mais')} className="grid h-11 w-11 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300" aria-label="Voltar">
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-400">Saúde operacional</p>
          <h1 className="font-heading text-xl font-black text-zinc-50">Diagnóstico local</h1>
          <p className="text-[10px] text-zinc-500">Não grava nem consulta dados extras no Firestore.</p>
        </div>
      </header>

      <LegacyImportAuditCard />

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <Database size={18} className="text-cyan-400" />
          <p className="mt-3 text-2xl font-black text-zinc-100">{summary.total}</p>
          <p className="text-[10px] text-zinc-500">documentos retornados nas sincronizações registradas</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <BellRing size={18} className="text-amber-400" />
          <p className="mt-3 text-2xl font-black text-zinc-100">{pendingNotifications ?? '—'}</p>
          <p className="text-[10px] text-zinc-500">notificações locais pendentes neste aparelho</p>
        </div>
      </section>

      <section aria-label="Resumo local da sincronização" className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
        <p className="text-xs font-bold text-zinc-200">Confiabilidade · últimas {localHealth.attempts} tentativas</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-xl bg-zinc-950/70 p-2"><b className="block text-emerald-400">{localHealth.successes}</b><span className="text-zinc-500">Sucessos</span></div>
          <div className="rounded-xl bg-zinc-950/70 p-2"><b className="block text-rose-400">{localHealth.errors}</b><span className="text-zinc-500">Falhas</span></div>
          <div className="rounded-xl bg-zinc-950/70 p-2"><b className="block text-cyan-400">{localHealth.averageReturnedDocuments}</b><span className="text-zinc-500">Docs/média</span></div>
        </div>
        {localHealth.recentHighVolume && <p className="mt-2 text-[11px] text-amber-300">Retornos altos recorrentes. Conferir intervalo e volume de dados; isto não mede o faturamento do Firestore.</p>}
        {localHealth.latestFailed && <p className="mt-2 text-[11px] text-rose-300">Última tentativa falhou. Dados locais podem estar desatualizados.</p>}
        {localHealth.consecutiveFailures > 1 && (
          <p role="status" className="mt-2 text-[11px] text-amber-300">
            {localHealth.consecutiveFailures} falhas consecutivas registradas. Verifique a conexão antes de tentar novamente.
          </p>
        )}
        {localHealth.latestSuccessAt && (
          <p className="mt-2 text-[10px] text-zinc-500">Último sucesso da amostra: {dateTime(localHealth.latestSuccessAt)}.</p>
        )}
        <p className="mt-2 text-[10px] text-zinc-500">Amostra do histórico local; sem novas consultas à nuvem. Detalhes privados são omitidos ao copiar.</p>
      </section>

      {collectionHotspots.length > 0 && <section aria-label="Ranking local de coleções" className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
        <div className="flex items-center gap-2"><Database size={15} className="text-sky-300" /><p className="text-xs font-black text-zinc-200">Volume por coleção</p></div>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Média dos últimos cinco sucessos locais (até cinco coleções). Zero consultas extras.</p>
        <div className="mt-3 space-y-2">{collectionHotspots.map((item) => (
          <div key={item.name} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
            <span className="min-w-0 truncate font-mono text-[10px] font-semibold text-zinc-300" title={item.name}>{item.name}</span>
            <span className="shrink-0 text-[10px] font-black tabular-nums text-sky-300">média {item.average} · último {item.latest}</span>
          </div>
        ))}</div>
        <p className="mt-2 text-[10px] text-zinc-600">Documentos retornados não equivalem a leituras faturadas. Examine picos antes de mudar índices ou regras do Firestore.</p>
      </section>}

      <section aria-label="Tempos das confirmações operacionais" className="mt-3 rounded-2xl border border-cyan-500/20 bg-zinc-900/45 p-3" data-dfl-action-latency="true">
        <div className="flex items-center gap-2"><Activity size={16} className="text-cyan-400"/><h2 className="text-xs font-black text-zinc-100">Tempo de confirmação</h2></div>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Últimas 60 medições neste aparelho. Nenhum nome, ID, valor ou endereço. Os tempos não provam a origem exata da lentidão.</p>
        {actionLatencyGroups.length > 0 ? <div className="mt-3 space-y-2">{actionLatencyGroups.map((item) => <div key={item.kind} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[11px] text-zinc-200">{item.label}</b><span className="text-[10px] font-black tabular-nums text-cyan-300">média {(item.averageMs / 1000).toFixed(1)}s · P90 {(item.p90Ms / 1000).toFixed(1)}s</span></div>
          <p className="mt-1 text-[9px] text-zinc-500">{item.confirmed} confirmados · {item.failures} falhas/parciais · {item.slow} acima de 4s</p>
        </div>)}</div> : <p className="mt-3 text-[11px] text-zinc-500">Sem medições. Inicie uma rota ou conclua uma entrega para começar.</p>}
      </section>

      <button type="button" disabled={isSyncing || syncChecking} onClick={handleSync} className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3.5 text-sm font-black text-cyan-300 active:scale-[.98] disabled:opacity-50">
        <RefreshCw size={17} className={isSyncing || syncChecking ? 'animate-spin' : ''} />
        {isSyncing || syncChecking ? 'Sincronizando…' : syncError ? 'Tentar sincronizar novamente' : 'Sincronizar agora'}
      </button>

      <div className="mt-4">
        <ReportMaintenanceCard />
      </div>

      <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
        <div className="flex items-center gap-2"><Activity size={17} className="text-emerald-400" /><b className="text-sm text-zinc-100">Última sincronização</b></div>
        <p className="mt-2 text-xs text-zinc-400">
          {summary.last ? `${dateTime(summary.last.finishedAt)} · ${summary.last.status === 'success' ? 'concluída' : 'falhou'} · ${(summary.last.durationMs / 1000).toFixed(1)}s` : 'Ainda não registrada nesta versão.'}
        </p>
        {summary.last?.status === 'success' && <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] font-bold text-zinc-300">Maior retorno por coleção na última sincronização</p>
          <div className="mt-2 space-y-1.5">
            {Object.entries(summary.last.collections).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between gap-3 text-[10px]">
                <span className="truncate text-zinc-500">{name.replaceAll('_', ' ')}</span>
                <strong className="tabular-nums text-zinc-200">{count} documentos</strong>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">Documentos retornados não são uma medição exata de leituras faturadas. Sem consulta extra ao banco.</p>
        </div>}
        {summary.errors > 0 && <p className="mt-1 text-[10px] text-red-400">{summary.errors} falha(s) no histórico local.</p>}
        {summary.repeatedHighVolume && <p className="mt-2 rounded-xl bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-400">Volume alto repetido: duas ou mais sincronizações recentes retornaram pelo menos 300 documentos. Copie o diagnóstico para investigação.</p>}
      </section>

      <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><Send size={17} className="text-violet-400"/><b className="text-sm text-zinc-100">Recuperacao Site</b></div><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Confirma apenas o relay Entregas → Site. Não prova envio de WhatsApp. Consulta somente ao abrir; sem polling.</p></div>
          <button type="button" disabled={Boolean(recoveryBusy)} onClick={() => void loadRecovery()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 disabled:opacity-50" aria-label="Consultar fila"><RefreshCw size={15} className={recoveryBusy === 'loading' ? 'animate-spin' : ''}/></button>
        </div>
        {recovery && <>
          <div className="mt-3 grid grid-cols-4 gap-1.5">{(['pending','processing','failed','dead_letter'] as const).map((status)=><div key={status} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2 text-center"><b className="block text-sm text-zinc-100">{recovery.stats[status] || 0}</b><span className="text-[7px] uppercase text-zinc-600">{status === 'dead_letter' ? 'bloqueado' : status}</span></div>)}</div>
          <div className="mt-3 space-y-2">{recovery.issues.map((issue)=><article key={issue.eventId} className="rounded-xl border border-zinc-800 bg-black/20 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate text-[10px] text-zinc-200">{issue.eventType}</b><span className="block truncate text-[8px] text-zinc-600">{issue.entityId} · tentativa {issue.attempts}</span></div><span className={`rounded-md px-1.5 py-1 text-[7px] font-black uppercase ${issue.status === 'failed' || issue.status === 'dead_letter' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{issue.status}</span></div>{issue.lastError&&<p className="mt-2 line-clamp-2 text-[9px] text-red-300/80">{issue.lastError}</p>}<button type="button" disabled={Boolean(recoveryBusy)} onClick={()=>void retryEvent(issue.eventId)} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[.07] text-[9px] font-black text-violet-300 disabled:opacity-50"><RotateCcw size={13} className={recoveryBusy === issue.eventId ? 'animate-spin' : ''}/>{recoveryBusy === issue.eventId ? 'Reprocessando...' : 'Reprocessar este evento'}</button></article>)}</div>
          {!recovery.issues.length&&<p className="mt-3 rounded-xl border border-dashed border-zinc-800 p-4 text-center text-[10px] text-emerald-400">Sem pendência no relay Entregas → Site. WhatsApp não verificado.</p>}
        </>}
      </section>

      <MessageTraceCard />

      {pendingPreview.length > 0 && (
        <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
          <b className="text-xs text-zinc-200">Próximas notificações neste aparelho</b>
          <div className="mt-2 space-y-2">
            {pendingPreview.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-[10px]">
                <span className="min-w-0 truncate text-zinc-400">{item.title}</span>
                <span className="shrink-0 text-zinc-600">{item.at ? dateTime(item.at) : 'sem horário'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 space-y-2">
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <b className={entry.status === 'success' ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{entry.status === 'success' ? 'Sincronização concluída' : 'Falha de sincronização'}</b>
              <span className="text-[9px] text-zinc-600">{dateTime(entry.finishedAt)}</span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">{entry.totalDocuments} documentos · {(entry.durationMs / 1000).toFixed(1)}s</p>
            <p className="mt-2 break-words text-[9px] leading-relaxed text-zinc-600">
              {Object.entries(entry.collections).map(([name, count]) => `${name}: ${count}`).join(' · ') || entry.message || 'Sem contagem disponível.'}
            </p>
          </article>
        ))}
        {!entries.length && <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-600">Sincronize o aplicativo para iniciar o histórico.</div>}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-500 font-black text-zinc-950"><Clipboard size={16} />Copiar</button>
        <button type="button" onClick={clear} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 font-black text-red-400"><Trash2 size={16} />Limpar local</button>
      </div>
    </div>
  );
}
