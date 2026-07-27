'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 pb-4 pt-2 border-b border-zinc-800/80 mb-5">
      <button
        onClick={() => router.back()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-transform active:scale-95"
        aria-label="Voltar"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="flex flex-col">
        <h1 className="font-heading text-lg font-bold text-zinc-50 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}
