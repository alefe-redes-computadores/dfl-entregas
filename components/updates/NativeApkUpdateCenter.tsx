'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { BellRing, CheckCircle2, ChevronRight, Download, ExternalLink, HardDriveDownload, LoaderCircle, RefreshCcw, ShieldCheck, Smartphone, WifiOff, XCircle } from 'lucide-react';
import { checkCertifiedAndroidApk } from '@/lib/native/apk-release-service';
import { APK_ACTIONS_URL, isNewCertifiedApk, parseInstalledApkBuild, type AndroidBuildStatus, type CertifiedApk } from '@/lib/native/apk-release-policy';
import { getDflApkUpdater } from '@/lib/native/apk-updater';
import { apkAlertsEnabled, checkAndNotifyApkUpdate, setApkAlertsEnabled } from '@/lib/native/apk-update-alerts';
import { DFL_UPDATE_NOTES } from '@/lib/native/apk-release-notes';

type Phase = 'idle' | 'downloading' | 'installing' | 'permission' | 'installer' | 'error';
type Result = 'checking' | 'ready' | 'error';
const mb = (bytes: number) => (Math.max(0, bytes) / 1048576).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const openPage = (url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); };

export function NativeApkUpdateCenter() {
  const [installed, setInstalled] = useState<{ name: string; version: string; build: number | null } | null>(null);
  const [apk, setApk] = useState<CertifiedApk | null>(null);
  const [workflow, setWorkflow] = useState<AndroidBuildStatus | null>(null);
  const [status, setStatus] = useState<Result>('checking');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [percent, setPercent] = useState(0);
  const [verifiedDownload, setVerifiedDownload] = useState(false);
  const [received, setReceived] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState('');
  const mounted = useRef(false);
  const busy = useRef(false);
  const cancelFlag = useRef(false);
  const installBusy = useRef(false);
  const permissionReturn = useRef<CertifiedApk | null>(null);
  const bridge = getDflApkUpdater();

  const refresh = useCallback(async (force = false) => {
    if (mounted.current) setStatus('checking');
    try {
      const [info, data] = await Promise.all([App.getInfo(), checkCertifiedAndroidApk(force)]);
      if (!mounted.current) return;
      setInstalled(info.id === 'com.dfl.entregas' ? { name: info.name, version: info.version, build: parseInstalledApkBuild(info.build) } : null);
      setApk(data.apk);
      setWorkflow(data.status);
      setCheckedAt(new Date().toLocaleString('pt-BR'));
      setStatus('ready');
    } catch {
      if (mounted.current) { setStatus('error'); setCheckedAt(new Date().toLocaleString('pt-BR')); }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    setAlerts(apkAlertsEnabled());
    void refresh();
    return () => { mounted.current = false; permissionReturn.current = null; };
  }, [refresh]);

  const install = useCallback(async (release: CertifiedApk) => {
    const native = getDflApkUpdater();
    if (!native || installBusy.current || cancelFlag.current) return;
    installBusy.current = true;
    permissionReturn.current = null;
    setError(''); setPhase('installing');
    try {
      // Revalidação nativa de tamanho, hash, pacote, versão e certificado a cada tentativa.
      const result = await native.installVerified({ build: release.build, sha256: release.sha256 });
      if (!mounted.current) return;
      if (result.permissionRequired) { setPhase('permission'); return; }
      if (!result.opened) throw new Error('O Android não abriu o instalador.');
      setPhase('installer');
    } catch (e) {
      if (mounted.current) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o instalador.'); setPhase('error'); }
    } finally { installBusy.current = false; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let listener: { remove(): Promise<void> } | null = null;
    const resume = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const ready = permissionReturn.current;
      if (!ready) return;
      permissionReturn.current = null;
      void install(ready);
    };
    const onForeground = (e: Event) => { if (document.visibilityState === 'visible') resume(); };
    void App.addListener('appStateChange', ({ isActive }) => { if (isActive) resume(); }).then(handle => {
      if (cancelled) void handle.remove(); else listener = handle;
    }).catch(() => undefined);
    document.addEventListener('visibilitychange', onForeground);
    return () => { cancelled = true; permissionReturn.current = null; document.removeEventListener('visibilitychange', onForeground); if (listener) void listener.remove(); };
  }, [install]);

  const newer = isNewCertifiedApk(installed?.build ?? null, apk);
  const download = async () => {
    const release = apk;
    const native = getDflApkUpdater();
    if (!native || !newer || !release || busy.current || !['idle', 'error'].includes(phase)) return;
    busy.current = true;
    cancelFlag.current = false;
    setCancelling(false); setPercent(0); setReceived(0); setVerifiedDownload(false); setError(''); setPhase('downloading');
    let handle: { remove(): Promise<void> } | null = null;
    try {
      handle = await native.addListener('downloadProgress', e => {
        if (e.build !== release.build || cancelFlag.current || !mounted.current) return;
        setReceived(Math.max(0, Math.min(release.bytes, e.received)));
        setPercent(Math.max(0, Math.min(100, e.percent)));
      });
      if (cancelFlag.current) throw new Error('Download cancelado.');
      const result = await native.downloadVerified({ build: release.build, sha256: release.sha256, bytes: release.bytes });
      if (cancelFlag.current) throw new Error('Download cancelado.');
      if (!result.verified || result.build !== release.build) throw new Error('O Android não certificou o arquivo.');
      setReceived(release.bytes); setPercent(100); setVerifiedDownload(true);
      await install(release);
    } catch (e) {
      if (mounted.current) { setError(cancelFlag.current ? 'Download cancelado. Nenhuma instalação iniciada.' : e instanceof Error ? e.message : 'Download não concluído.'); setPhase('error'); }
    } finally {
      if (handle) await handle.remove().catch(() => undefined);
      busy.current = false;
      if (mounted.current) setCancelling(false);
    }
  };
  const cancel = async () => {
    const native = getDflApkUpdater();
    if (!native || !busy.current || cancelFlag.current) return;
    cancelFlag.current = true;
    setCancelling(true);
    await native.cancelDownload().catch(() => undefined);
  };
  const openOfficialRelease = async (release: CertifiedApk) => {
    const native = getDflApkUpdater();
    if (native) {
      try { await native.openReleasePage({ build: release.build }); return; }
      catch { /* Recuperação no browser da WebView, sem interromper a operação. */ }
    }
    openPage(release.releaseUrl);
  };
  const grantAndResume = async () => {
    const native = getDflApkUpdater();
    if (!native || !apk || phase !== 'permission') return;
    permissionReturn.current = apk;
    try { await native.openInstallSettings(); }
    catch { permissionReturn.current = null; setError('Não foi possível abrir a configuração de autorização.'); setPhase('error'); }
  };
  const toggleAlerts = async () => {
    if (alertBusy) return;
    setAlertBusy(true);
    try {
      const enabled = await setApkAlertsEnabled(!alerts);
      setAlerts(enabled);
      if (enabled) void checkAndNotifyApkUpdate(true);
    } finally { setAlertBusy(false); }
  };

  return (
    <section aria-label="Atualização certificada do Android" className="space-y-3">
      <div className="overflow-hidden rounded-[26px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.12] via-zinc-900/65 to-zinc-950 p-4 shadow-[0_16px_40px_rgba(0,0,0,.15)]">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><Smartphone size={23}/></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">Android · APK instalado</p><h2 className="mt-1 text-lg font-black leading-tight">Atualização do Entregas</h2><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Build certificado, sem confundir mudanças do site com a versão instalada no celular.</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-zinc-700/40 bg-zinc-950/55 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-zinc-500">Neste aparelho</p><p className="mt-1 text-xl font-black tabular-nums">{installed?.build ? `#${installed.build}` : '—'}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{installed?.version ? `Versão ${installed.version}` : 'Versão Android indisponível'}</p></div>
          <div className="rounded-2xl border border-zinc-700/40 bg-zinc-950/55 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-zinc-500">Mais recente certificado</p><p className="mt-1 text-xl font-black tabular-nums">{apk ? `#${apk.build}` : '—'}</p><p className="mt-1 text-[10px] text-zinc-500">{apk ? 'GitHub Release verificada' : 'Ainda não confirmado'}</p></div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-950/40 px-3 py-2.5 text-xs">
          {status === 'checking' ? <LoaderCircle className="shrink-0 animate-spin text-sky-300" size={17}/> : status === 'error' ? <WifiOff className="shrink-0 text-amber-300" size={17}/> : newer ? <Download className="shrink-0 text-emerald-300" size={17}/> : <CheckCircle2 className="shrink-0 text-zinc-400" size={17}/>}
          <span className="min-w-0 text-zinc-200">{status === 'checking' ? 'Consultando builds certificados…' : status === 'error' ? 'Sem conexão ou resposta confiável; operação preservada.' : newer ? `Nova versão #${apk?.build} pronta para atualizar.` : installed?.build && apk ? 'Seu APK está nesta versão ou em uma mais recente.' : 'Nenhuma atualização certificada disponível no momento.'}</span>
        </div>
        <button type="button" disabled={status === 'checking' || phase === 'downloading' || phase === 'installing'} onClick={() => void refresh(true)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/40 text-xs font-bold text-zinc-200 disabled:opacity-40"><RefreshCcw size={15} className={status === 'checking' ? 'animate-spin' : ''}/> Conferir versões novamente</button>
        {checkedAt && <p className="mt-2 text-center text-[10px] text-zinc-500">Última consulta: {checkedAt}</p>}
      </div>

      {newer && apk && <div className="space-y-3 rounded-[24px] border border-emerald-400/25 bg-zinc-900/65 p-4">
        <div className="flex items-center gap-2"><HardDriveDownload size={18} className="text-emerald-300"/><h3 className="text-sm font-black">Instalar a versão #{apk.build}</h3></div>
        <p className="text-[11px] leading-relaxed text-zinc-400">Arquivo de {mb(apk.bytes)} MB, assinado e com SHA-256 publicado. O Android confirma a instalação antes de substituir o aplicativo.</p>
        {!bridge && <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/[.08] p-3 text-xs text-amber-200">O APK instalado ainda não tem a ponte de atualização P3. Instale manualmente a primeira versão compatível pela página da Release; as próximas terão instalação integrada.</p>}
        {phase === 'downloading' && <div role="status" aria-live="polite" className="space-y-2 rounded-2xl border border-emerald-400/15 bg-black/25 p-3">
          <div className="flex justify-between gap-2 text-xs font-bold text-emerald-200"><span>{cancelling ? 'Cancelando com segurança…' : 'Baixando o APK…'}</span><span className="tabular-nums">{percent}%</span></div>
          <div role="progressbar" aria-label="Progresso do APK" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2.5 overflow-hidden rounded-full bg-zinc-700"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }}/></div>
          <p className="text-xs text-zinc-400">{mb(received)} de {mb(apk.bytes)} MB</p>
          <button type="button" onClick={() => void cancel()} disabled={cancelling} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 text-xs font-black disabled:opacity-50"><XCircle size={16}/> {cancelling ? 'Cancelamento solicitado' : 'Cancelar download'}</button>
        </div>}
        {phase === 'installing' && <p role="status" className="rounded-xl bg-sky-400/10 p-3 text-xs text-sky-200">Conferindo arquivo, pacote, versão e assinatura antes de abrir o Android…</p>}
        {phase === 'permission' && <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200"><p className="font-black">Arquivo verificado. Autorize esta origem nas configurações do Android.</p><p>Ao voltar, o instalador será solicitado uma vez. A confirmação final continua no sistema.</p><button type="button" onClick={() => void grantAndResume()} className="min-h-12 w-full rounded-xl bg-amber-400 px-3 font-black text-zinc-950">Abrir autorização Android</button><button type="button" onClick={() => void install(apk)} className="min-h-10 w-full underline underline-offset-4">Já autorizei? Tentar instalar</button></div>}
        {phase === 'installer' && <div role="status" className="space-y-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-200"><p className="font-black">Instalador solicitado ao Android</p><p>Confirme na tela do sistema. A instalação ainda não foi declarada como concluída.</p><button type="button" onClick={() => void install(apk)} className="min-h-11 w-full rounded-xl border border-emerald-400/30 font-bold">Abrir instalador novamente</button></div>}
        {phase === 'error' && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{error || 'A atualização não foi concluída.'} A operação do app continua intacta.</p>}
        {bridge && (phase === 'idle' || (phase === 'error' && !verifiedDownload)) && <button type="button" onClick={() => void download()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-zinc-950 active:scale-[.99]"><Download size={18}/> {phase === 'error' ? 'Tentar baixar novamente' : 'Baixar e atualizar agora'}</button>}
        {bridge && phase === 'error' && verifiedDownload && <button type="button" onClick={() => void install(apk)} className="min-h-11 w-full rounded-xl border border-emerald-400/30 text-xs font-black text-emerald-200">Tentar instalação sem baixar novamente</button>}
        <button type="button" onClick={() => void openOfficialRelease(apk)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300"><ExternalLink size={16}/> Abrir página oficial da Release</button>
      </div>}

      <section className="rounded-[23px] border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BellRing size={18} className="text-emerald-300"/><h3 className="text-sm font-black">Avisos de novas versões</h3></div><button type="button" onClick={() => void toggleAlerts()} disabled={alertBusy} aria-pressed={alerts} className={`min-h-10 rounded-xl px-3 text-[11px] font-black disabled:opacity-40 ${alerts ? 'bg-emerald-500/10 text-emerald-200' : 'bg-zinc-800 text-zinc-400'}`}>{alertBusy ? 'Verificando…' : alerts ? 'Ativados' : 'Desativados'}</button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Opcional neste aparelho. Um aviso por build certificado quando o app é aberto ou retomado, respeitando silêncio e prioridades da P2. Não é push remoto nem mensagem externa.</p>
      </section>
      <section className="rounded-[23px] border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-sky-300"/><h3 className="text-sm font-black">Integridade e distribuição</h3></div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">Somente a Action aprovada da branch main, com commit correspondente, asset oficial, SHA-256, pacote <span className="font-mono text-zinc-200">com.dfl.entregas</span>, versão superior e certificado compatível. Sem tokens GitHub no aplicativo.</p>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Última Action: {workflow?.kind === 'running' ? `build #${workflow.build} em andamento` : workflow?.kind === 'failed' ? `build #${workflow.build} falhou` : workflow?.kind === 'success' ? `build #${workflow.build} aprovado` : 'indisponível'}{workflow?.kind === 'success' && !apk ? ' · Release verificável ainda indisponível' : ''}.</p>
        <button type="button" onClick={() => openPage(APK_ACTIONS_URL)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300"><ExternalLink size={15}/> Abrir histórico de builds Android</button>
      </section>
      <section className="rounded-[23px] border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-black">Novidades recentes</h3><p className="mt-1 text-[11px] text-zinc-500">O histórico descreve melhorias; os números reais do APK estão acima.</p>
        <div className="mt-3 space-y-2">{DFL_UPDATE_NOTES.map((entry, i) => <details key={entry.name} open={i === 0} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3"><summary className="cursor-pointer list-none text-xs font-black text-zinc-200"><span className="text-emerald-300">{entry.name}</span> · {entry.title}</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-zinc-400">{entry.changes.map(change => <li key={change}>{change}</li>)}</ul></details>)}</div>
      </section>
    </section>
  );
}
