'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  to: string;
}

export function PageHeader({ title, subtitle, to }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-5 flex items-center gap-3 border-b border-zinc-800/80 pb-4 pt-2">
      <button
        type="button"
        onClick={() => router.replace(to)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300 transition active:scale-95"
        aria-label="Voltar"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="min-w-0">
        <h1 className="truncate font-heading text-lg font-bold leading-tight text-zinc-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
