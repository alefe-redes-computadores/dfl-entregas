'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { auth } from '@/lib/firebase';

type MonitorState = {
  lastReportsAt: string | null;
  lastManualAt: string | null;
  lastManualStatus: string | null;
  lastManualDurationMs: number | null;
  lastManualProcessed: number | null;
  lastManualError: string | null;
  lastQuotaAt: string | null;
  nextAutomaticReports: string;
  manualCooldownMinutes: number;
};

function dateTime(value: string | null) {
  if (!value) return 'Ainda não registrado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

export function ReportMaintenanceCard() {
  const [state, setState] = useState<MonitorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const request = useCallback(async (method: 'GET' | 'POST') => {
    const user = auth.currentUser;
    if (!user) throw new Error('Entre novamente para atualizar os relatórios.');
    const token = await user.getIdToken();
    const response = await fetch('/api/integration/maintenance', { method, headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    const body = await response.json() as { ok?: boolean; error?: string; processed?: number; state?: MonitorState };
    if (body.state) setState(body.state);
    if (!response.ok || !body.ok) throw new Error(body.error || 'Não foi possível atualizar.');
    return body;
  }, []);

  useEffect(() => {
    request('GET').catch(() => setMessage('Monitor indisponível agora. Os relatórios continuam funcionando.')).finally(() => setLoading(false));
  }, [request]);

  async function refresh() {
    if (running || !window.confirm('Atualizar a projeção dos relatórios agora? O botão ficará protegido por 30 minutos.')) return;
    setRunning(true);
    setMessage(null);
    try {
      const result = await request('POST');
      setMessage(`Atualização concluída${typeof result.processed === 'number' ? ` · ${result.processed} registro${result.processed === 1 ? '' : 's'} processado${result.processed === 1 ? '' : 's'}` : ''}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar.');
    } finally {
      setRunning(false);
    }
  }

  const healthy = state?.lastManualStatus !== 'error' && state?.lastManualStatus !== 'quota';
  return (
    <section className="rounded-[26px] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 to-zinc-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Controle de leituras</p>
          <h2 className="mt-1 font-heading text-lg font-black text-zinc-100">Relatórios sob controle</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">Atualização automática {state?.nextAutomaticReports || 'terça-feira às 04:00'}. O histórico visível nunca é apagado se uma tentativa falhar.</p>
        </div>
        {healthy ? <ShieldCheck className="shrink-0 text-emerald-400" size={23} /> : <TriangleAlert className="shrink-0 text-amber-400" size={23} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-zinc-950/55 p-3"><CalendarClock size={15} className="text-emerald-400" /><p className="mt-2 text-[9px] font-bold uppercase text-zinc-600">Última projeção</p><strong className="mt-1 block text-xs text-zinc-200">{loading ? 'Consultando…' : dateTime(state?.lastReportsAt || null)}</strong></div>
        <div className="rounded-2xl bg-zinc-950/55 p-3"><Activity size={15} className="text-amber-400" /><p className="mt-2 text-[9px] font-bold uppercase text-zinc-600">Última execução</p><strong className="mt-1 block text-xs text-zinc-200">{state?.lastManualProcessed != null ? `${state.lastManualProcessed} processados` : 'Automática protegida'}</strong></div>
      </div>

      {message && <p className={`mt-3 rounded-2xl px-3 py-2 text-xs ${message.includes('concluída') ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>{message}</p>}
      {state?.lastManualError && !message && <p className="mt-3 text-xs text-amber-300">{state.lastManualError}</p>}

      <button type="button" disabled={running || loading} onClick={refresh} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3.5 text-sm font-black text-zinc-950 transition active:scale-[.98] disabled:opacity-50">
        <RefreshCw size={17} className={running ? 'animate-spin' : ''} />
        {running ? 'Atualizando com segurança…' : 'Atualizar relatórios agora'}
      </button>
      <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-wider text-zinc-600">Proteção contra repetição: {state?.manualCooldownMinutes || 30} minutos</p>
    </section>
  );
}
