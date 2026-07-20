'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function ConfirmarEntregasPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      {/* Header Customizado DFL */}
      <div className="safe-top flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-4">
        <button 
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-col">
          <h1 className="font-heading text-lg font-bold text-zinc-50">
            DFL Confirmar Entregas
          </h1>
          <p className="text-[11px] text-zinc-500">Portal do Entregador</p>
        </div>
      </div>

      {/* Iframe do iFood - Pega o resto da tela toda */}
      <div className="relative flex-1 bg-white">
        <iframe 
          src="https://confirmacao-entrega-propria.ifood.com.br"
          className="absolute inset-0 h-full w-full border-none"
          title="Confirmação iFood"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}
