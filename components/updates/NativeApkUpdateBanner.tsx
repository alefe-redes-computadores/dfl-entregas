'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Download, ChevronRight } from 'lucide-react';
import { checkCertifiedAndroidApk } from '@/lib/native/apk-release-service';
import { isNewCertifiedApk, parseInstalledApkBuild } from '@/lib/native/apk-release-policy';

/** Banner contextual: somente quando um APK certificado é MAIS NOVO, sem atrapalhar a operação. */
export function NativeApkUpdateBanner() {
  const router = useRouter();
  const [newBuild, setNewBuild] = useState<number | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    let alive = true;
    const check = async () => {
      try {
        const [info, result] = await Promise.all([App.getInfo(), checkCertifiedAndroidApk()]);
        if (!alive || info.id !== 'com.dfl.entregas') return;
        const build = parseInstalledApkBuild(info.build);
        setNewBuild(isNewCertifiedApk(build, result.apk) && result.apk ? result.apk.build : null);
      } catch { if (alive) setNewBuild(null); }
    };
    void check();
    const onForeground = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('dfl:app-foreground', onForeground);
    return () => { alive = false; window.removeEventListener('dfl:app-foreground', onForeground); };
  }, []);
  if (!newBuild) return null;
  return <button type="button" onClick={() => router.push('/mais/atualizacoes')} className="mb-3 flex min-h-[62px] w-full items-center gap-3 rounded-[20px] border border-emerald-400/25 bg-gradient-to-r from-emerald-500/[.12] to-zinc-900/65 p-3 text-left transition active:scale-[.99]">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Download size={19}/></span>
    <span className="min-w-0 flex-1"><strong className="block text-xs font-black text-emerald-200">Atualização do Entregas disponível</strong><small className="mt-1 block text-[11px] text-zinc-400">APK #{newBuild} certificado · instalar quando desejar</small></span>
    <ChevronRight size={17} className="shrink-0 text-emerald-300"/>
  </button>;
}
