'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ArrowLeft, CheckCircle2, Download, ExternalLink, Info, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { readWriteJournal, writeJournalSummary } from '@/lib/operation/operational-write-journal';
import { mayApplyPwaUpdate } from '@/lib/operation/pwa-reload-guard';
import { NativeApkUpdateCenter } from '@/components/updates/NativeApkUpdateCenter';
import { compareReleaseRevisions, shortReleaseRevision, validReleaseRevision, type ReleaseComparison } from '@/lib/operation/release-policy';

const INSTALLED_SHA = process.env.NEXT_PUBLIC_DFL_RELEASE_SHA || '';
const PUBLISHED_ORIGIN = (process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN || 'https://dfl-entregas.vercel.app').replace(/\/+$/, '');
const BUILDS_URL = 'https://github.com/alefe-redes-computadores/dfl-entregas/actions/workflows/main.yml';
type Result = 'idle' | 'checking' | 'available' | 'same' | 'unknown' | 'error';

type InstalledApp = { version: string; build: string; name: string };

export default function AtualizacoesPage() {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);
  const [installed, setInstalled] = useState<InstalledApp | null>(null);
  const [result, setResult] = useState<Result>('idle');
  const [comparison, setComparison] = useState<ReleaseComparison>('unknown');
  const [remoteRevision, setRemoteRevision] = useState<string | null>(null);
  const [workerWaiting, setWorkerWaiting] = useState(false);
  const [lastChecked, setLastChecked] = useState('');

  useEffect(() => {
    let alive = true;
    const isNative = Capacitor.isNativePlatform();
    setNative(isNative);
    setPlatformReady(true);
    if (isNative) {
      void App.getInfo().then(info => {
        if (alive) setInstalled({ version: info.version, build: info.build, name: info.name });
      }).catch(() => {
        if (alive) setInstalled(null);
      });
    }
    return () => { alive = false; };
  }, []);

  const checkUpdates = async () => {
    if (result === 'checking') return;
    setResult('checking');
    setWorkerWaiting(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    let remote: string | null = null;
    let remoteAvailable = false;
    try {
      const endpoint = native ? `${PUBLISHED_ORIGIN}/api/system/release` : '/api/system/release';
      const response = await fetch(endpoint, {
        method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error(`Consulta de versão indisponível (HTTP ${response.status}).`);
      }
      const data = await response.json() as { app?: unknown; revision?: unknown; available?: unknown };
      if (data.app !== 'dfl-entregas') throw new Error('Resposta de versão não identificada.');
      remote = validReleaseRevision(data.revision);
      remoteAvailable = data.available === true && Boolean(remote);
      setRemoteRevision(remote);
      const evaluated = compareReleaseRevisions(INSTALLED_SHA, remote);
      setComparison(evaluated);
      if (!native && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration('/');
          if (registration) {
            await registration.update();
            setWorkerWaiting(Boolean(registration.waiting));
            if (registration.waiting) {
              setResult('available');
              setLastChecked(new Date().toLocaleString('pt-BR'));
              return;
            }
          }
        } catch {
          // O servidor pode estar disponível mesmo com atualização SW indisponível.
        }
      }
      setResult(!remoteAvailable || evaluated === 'unknown' ? 'unknown' : evaluated === 'different' ? 'available' : 'same');
    } catch (error) {
      setResult('error');
      toast.warning('Não foi possível conferir a versão publicada.', {
        description: error instanceof Error ? error.message : 'Verifique a conexão e tente novamente.',
      });
    } finally {
      window.clearTimeout(timer);
      setLastChecked(new Date().toLocaleString('pt-BR'));
    }
  };

  const applyPwaUpdate = async () => {
    if (native) return;
    const owner = useAppStore.getState().user?.uid;
    const journal = writeJournalSummary(readWriteJournal(owner));
    const editingForm = Boolean(document.querySelector('[data-dfl-unsaved-form="true"]'));
    if (!mayApplyPwaUpdate({ pendingWrites: journal.pending, unverifiedWrites: journal.unverified, editingForm })) {
      toast.warning('Atualização adiada com segurança', {
        description: 'Há operação pendente, confirmação incerta ou formulário em edição. Conclua antes de recarregar.',
      });
      return;
    }
    if (!('serviceWorker' in navigator)) {
      toast.info('Atualização automática indisponível neste navegador.');
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      toast.info('Atualização liberada. O PWA será recarregado pelo controlador seguro.');
      return;
    }
    if (result === 'available' && comparison === 'different') {
      window.location.reload();
      return;
    }
    toast.info('Ainda não existe atualização PWA confirmada para aplicar.');
  };

  const statusText = result === 'checking' ? 'Consultando versão publicada…'
    : result === 'available' ? native ? 'Servidor atualizado · APK deve ser verificado separadamente' : 'Nova revisão web identificada'
      : result === 'same' ? 'Mesma revisão web publicada' : result === 'unknown' ? 'Não foi possível comparar as versões'
        : result === 'error' ? 'Consulta não concluída' : 'Nenhuma consulta realizada nesta sessão';

  return (
    <div className="dfl-page mx-auto max-w-3xl space-y-4 pb-[calc(env(safe-area-inset-bottom)+96px)] text-zinc-100">
      <header className="flex items-start gap-3 px-1 pt-1">
        <button type="button" onClick={() => router.back()} aria-label="Voltar" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/70 text-zinc-400"><ArrowLeft size={19}/></button>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">R300 · Atualizações</p><h1 className="mt-1 font-heading text-xl font-black">Central de Atualizações</h1><p className="mt-1 text-xs leading-relaxed text-zinc-400">Versão instalada, publicação web e segurança antes de atualizar.</p></div>
      </header>

      <section className="rounded-[24px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.09] to-zinc-950 p-4">
        <div className="flex items-center gap-2 text-emerald-300"><Smartphone size={18}/><h2 className="text-sm font-black">{platformReady ? native ? 'Aplicativo Android / Capacitor' : 'PWA ou navegador' : 'Identificando plataforma…'}</h2></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/25 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-zinc-500">Build local</p><p className="mt-1 font-mono text-sm font-black text-zinc-100">{shortReleaseRevision(INSTALLED_SHA)}</p></div>
          <div className="rounded-2xl bg-black/25 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-zinc-500">Revisão no servidor</p><p className="mt-1 font-mono text-sm font-black text-zinc-100">{shortReleaseRevision(remoteRevision)}</p></div>
        </div>
        {native && <p className="mt-3 text-xs text-zinc-300">Versão Android instalada: <strong>{installed ? `${installed.version} · build ${installed.build}` : 'não disponível pelo sistema'}</strong></p>}
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{statusText}</p>
        {lastChecked && <p className="mt-1 text-[10px] text-zinc-500">Última consulta nesta sessão: {lastChecked}</p>}
        <button type="button" disabled={!platformReady || result === 'checking'} onClick={() => void checkUpdates()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 font-black text-zinc-950 disabled:opacity-50">
          {result === 'checking' ? <LoaderCircle size={17} className="animate-spin"/> : <RefreshCw size={17}/>}{result === 'checking' ? 'Verificando…' : 'Verificar atualizações'}
        </button>
      </section>

      {!native && <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-sky-300"/><h2 className="text-sm font-black">Atualização segura do PWA</h2></div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">Não recarrega durante gravação pendente, resultado incerto ou edição ativa. A checagem não apaga cache, não envia pedidos e não sincroniza o Firestore.</p>
        <button type="button" disabled={result !== 'available'} onClick={() => void applyPwaUpdate()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 text-xs font-black text-sky-200 disabled:opacity-40"><Download size={16}/>Aplicar atualização quando seguro</button>
        {workerWaiting && <p className="mt-2 text-[11px] text-sky-300">Uma versão do Service Worker está aguardando ativação.</p>}
      </section>}

      {native && <NativeApkUpdateCenter />}
      {native && <details className="rounded-[18px] border border-zinc-800 bg-zinc-900/20 p-3"><summary className="cursor-pointer text-[11px] font-black text-zinc-500">Recuperação técnica · builds anteriores</summary><section className="mt-2 rounded-[22px] border border-amber-500/20 bg-amber-500/[.045] p-4">
        <div className="flex items-center gap-2"><Info size={18} className="text-amber-300"/><h2 className="text-sm font-black">Atualização do APK</h2></div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">Uma versão nova do servidor não comprova que um APK atualizado já foi gerado. A atualização do Android exige um build assinado e instalação. Nenhuma atualização será instalada automaticamente por esta tela.</p>
        <a href={BUILDS_URL} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200"><ExternalLink size={15}/>Consultar builds Android no GitHub</a>
      </section></details>}

      {result === 'error' && <p role="status" className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400"><WifiOff size={16} className="shrink-0"/>A operação continua funcionando; consultar atualizações é opcional.</p>}
      <div className="flex items-start gap-2 px-2 text-[11px] leading-relaxed text-zinc-500"><CheckCircle2 size={17} className="shrink-0 text-emerald-500"/><p>Atualização do aplicativo, entrega concluída e recebimento de mensagens são confirmações diferentes. Esta tela não declara nenhum desses eventos sem evidência.</p></div>
    </div>
  );
}
