'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Activity, BellRing, ChevronLeft, Clipboard, Database, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  clearSyncDiagnostics,
  readSyncDiagnostics,
  syncDiagnosticText,
  type SyncDiagnostic,
} from '@/lib/sync-diagnostics';

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));

export default function OperationalDiagnosticsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<SyncDiagnostic[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<number | null>(null);
  const [pendingPreview, setPendingPreview] = useState<
    Array<{ id: number; title: string; at?: string }>
  >([]);

  useEffect(() => {
    setEntries(readSyncDiagnostics());
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(syncDiagnosticText(entries));
      toast.success('Diagnóstico copiado.');
    } catch {
      toast.error('Não foi possível copiar o diagnóstico.');
    }
  };

  const clear = () => {
    clearSyncDiagnostics();
    setEntries([]);
    toast.success('Histórico local apagado.');
  };

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

      <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
        <div className="flex items-center gap-2"><Activity size={17} className="text-emerald-400" /><b className="text-sm text-zinc-100">Última sincronização</b></div>
        <p className="mt-2 text-xs text-zinc-400">
          {summary.last ? `${dateTime(summary.last.finishedAt)} · ${summary.last.status === 'success' ? 'concluída' : 'falhou'} · ${(summary.last.durationMs / 1000).toFixed(1)}s` : 'Ainda não registrada nesta versão.'}
        </p>
        {summary.errors > 0 && <p className="mt-1 text-[10px] text-red-400">{summary.errors} falha(s) no histórico local.</p>}
        {summary.repeatedHighVolume && <p className="mt-2 rounded-xl bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-400">Volume alto repetido: duas ou mais sincronizações recentes retornaram pelo menos 300 documentos. Copie o diagnóstico para investigação.</p>}
      </section>

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
