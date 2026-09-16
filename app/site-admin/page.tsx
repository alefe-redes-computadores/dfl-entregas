'use client';

import { ArrowLeft, ExternalLink, ShieldCheck, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const SITE_ADMIN_URL = 'https://dafamilialanches.com.br/admin';

export default function SiteAdminPage() {
  const router = useRouter();

  const vibrate = async (style: ImpactStyle) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
    }
  };

  const leave = async () => {
    await vibrate(ImpactStyle.Light);
    router.replace('/loja');
  };

  const openExternal = async () => {
    await vibrate(ImpactStyle.Light);
    window.open(SITE_ADMIN_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="safe-top border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={leave}
            aria-label="Voltar para Minha Loja"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
            <Store size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
              DFL Site · Administração
            </p>
            <h1 className="truncate font-heading text-base font-black text-zinc-50">
              Admin do Site
            </h1>
          </div>

          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400 min-[390px]:flex">
            <ShieldCheck size={12} />
            Oficial
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/55 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-zinc-300">
              Administração comercial
            </p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-500">
              Pedidos, cozinha, expedição, cardápio, cupons e fidelidade continuam sob autoridade do DFL Site.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openExternal}
              className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[10px] font-black text-zinc-300 active:scale-95"
              title="Abrir o Admin fora do DFL Entregas"
            >
              <ExternalLink size={12} />
              Externo
            </button>
            <button
              type="button"
              onClick={leave}
              className="rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[10px] font-black text-amber-300 active:scale-95"
            >
              Voltar
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
        <section className="w-full max-w-md rounded-[28px] border border-zinc-800 bg-zinc-900/55 p-5 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
            <Store size={24} />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-amber-400">Administração comercial</p>
          <h2 className="mt-1 font-heading text-xl font-black text-zinc-50">Abrir no DFL Site</h2>
          <p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed text-zinc-500">
            O Admin usa a sessão própria do DFL Site. Abra fora do DFL Entregas para continuar com o login já existente no navegador.
          </p>
          <button type="button" onClick={openExternal} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 font-black text-zinc-950 active:scale-[.99]">
            <ExternalLink size={17} /> Abrir Admin do Site
          </button>
          <button type="button" onClick={leave} className="mt-2 h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 text-[11px] font-black text-zinc-400 active:scale-[.99]">
            Voltar para Minha Loja
          </button>
          <p className="mt-5 border-t border-zinc-800 pt-4 text-left text-[9px] leading-relaxed text-zinc-600">
            O Entregas mantém a operação logística. Pedidos, cozinha, expedição, cardápio, cupons e fidelidade continuam sob autoridade comercial do DFL Site.
          </p>
        </section>
      </main>
    </div>
  );
}
