"use client";

import { AlertCircle, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { shouldSuppressStockConsumptionIntelligence } from "@/lib/stock-semantic-confidence-v24-8";

type Props = {
  productId?: string | null;
  compact?: boolean;
};

export function StockSemanticReviewNotice({ productId, compact = false }: Props) {
  const router = useRouter();
  if (!shouldSuppressStockConsumptionIntelligence(productId)) return null;

  return (
    <div
      data-stock-semantic-review
      className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-amber-400/15 bg-amber-400/10 p-2 text-amber-200">
          <AlertCircle size={17} strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">
            Consumo aguardando revisão da unidade
          </p>
          {!compact && (
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              O histórico deste item usa unidades diferentes ao longo do tempo.
              Saldo e movimentações continuam válidos; a previsão foi pausada
              para evitar uma estimativa incorreta.
            </p>
          )}
          <button
            type="button"
            onClick={() => productId && router.push(`/estoque/editar?id=${encodeURIComponent(productId)}`)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 transition hover:text-white"
          >
            Revisar unidade <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
