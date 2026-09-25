'use client';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { StockProduct } from '@/types';
import { commercialMigrationHint, legacyCommercialState } from '@/lib/stock-commercial-cost';
export function CommercialMigrationNotice({product}:{product:StockProduct}){
 const state=legacyCommercialState(product); if(!state.needsReview)return <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4"/>Compra comercial configurada. Alterações futuras não reinterpretam o histórico.</div>;
 return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"/><div><p className="text-xs font-bold text-amber-200">Configuração comercial pendente</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{commercialMigrationHint(product)} A unidade de controle atual permanece intacta.</p></div></div></div>;
}
