'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ClipboardCopy, Database, ShieldCheck, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/lib/operational-toast';
import { auditLegacyImports, legacyAuditText } from '@/lib/operation/legacy-import-audit';

/** DFL_R202_LEGACY_AUDIT: apenas dados que a store já sincronizou. Sem writes. */
export function LegacyImportAuditCard() {
  const deliveries = useAppStore(state=>state.deliveries);
  const report = useMemo(()=>auditLegacyImports(deliveries),[deliveries]);
  const [expanded,setExpanded] = useState(false);
  const [onlyStrong,setOnlyStrong] = useState(false);
  const [needle,setNeedle] = useState('');
  const visible = useMemo(()=>report.groups.filter(group=>
    (!onlyStrong || group.kind==='confirmada_por_identidade') &&
    (!needle.trim() || [group.key,...group.documentIds].join(' ').toLowerCase().includes(needle.trim().toLowerCase()))
  ).slice(0,30),[report.groups,onlyStrong,needle]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(legacyAuditText(report)); toast.success('Auditoria local copiada sem dados pessoais.'); }
    catch { toast.error('Não foi possível copiar a auditoria.'); }
  };
  return (
    <section aria-label="R202 Auditoria de importações legadas" className="mt-3 overflow-hidden rounded-[24px] border border-amber-500/20 bg-gradient-to-br from-amber-500/[.065] via-zinc-900/50 to-zinc-950/40 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300"><Database size={19}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.17em] text-amber-400">R202 · Integridade da importação</p>
          <h2 className="mt-0.5 text-sm font-black text-zinc-100">Radar de pedidos legados</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Analisa apenas registros já carregados neste aparelho. Não exclui, funde, altera ou consulta pedidos na nuvem.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {name:'Plataformas',value:report.total},
          {name:'IDs antigos',value:report.legacy},
          {name:'Colisões fortes',value:report.strongGroups},
          {name:'Para revisar',value:report.reviewGroups},
        ].map(({name,value})=><div key={name} className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-3"><p className="text-lg font-black tabular-nums text-zinc-100">{value}</p><p className="text-[10px] text-zinc-500">{name}</p></div>)}
      </div>
      {report.strongGroups>0 ? <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-200"><AlertTriangle size={16} className="shrink-0"/>{report.affectedDocuments} documento(s) em possíveis colisões. Confira o histórico antes de qualquer correção.</p>
        : <p className="mt-3 flex items-start gap-2 text-[11px] text-emerald-300"><ShieldCheck size={16} className="shrink-0"/>Nenhuma colisão forte detectada nos dados carregados. Isso não comprova ausência de duplicatas remotas.</p>}
      {report.unidentified>0 && <p className="mt-2 text-[11px] text-zinc-400">{report.unidentified} registro(s) sem identidade comercial suficiente para comparação segura.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/75 px-3 text-xs font-bold text-zinc-200"><ChevronDown size={16} className={expanded?'rotate-180':''}/>{expanded?'Ocultar análise':'Ver grupos de revisão'}</button>
        <button type="button" onClick={()=>void copy()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300"><ClipboardCopy size={16}/>Copiar relatório</button>
      </div>
      {expanded && <div className="mt-3 space-y-2">
        <label className="relative block"><Search size={16} className="absolute left-3 top-3.5 text-zinc-500"/><input value={needle} onChange={event=>setNeedle(event.target.value)} placeholder="Buscar chave ou ID interno" aria-label="Buscar grupos de duplicidade" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-3 text-xs text-zinc-100 outline-none focus:border-amber-500"/></label>
        <button type="button" role="switch" aria-checked={onlyStrong} onClick={()=>setOnlyStrong(value=>!value)} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-[11px] font-bold text-zinc-300">{onlyStrong?'Mostrar também suspeitas':'Mostrar só colisões fortes'}</button>
        {visible.map(group=><div key={group.key} className="rounded-xl border border-zinc-800 bg-zinc-950/55 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={group.kind==='confirmada_por_identidade'?'text-[11px] font-bold text-amber-300':'text-[11px] font-bold text-sky-300'}>{group.kind==='confirmada_por_identidade'?'Mesma identidade comercial':'Número igual · revisão humana'}</span><span className="text-[10px] text-zinc-500">{group.legacyCount} antigo(s) · {group.canonicalCount} R201</span></div>
          <p className="mt-1 break-all font-mono text-[10px] text-zinc-400">{group.key}</p>
          <p className="mt-1 break-all text-[10px] text-zinc-500">Documentos: {group.documentIds.slice(0,8).join(' · ')}{group.documentIds.length>8?' · …':''}</p>
        </div>)}
        {!visible.length && <p className="rounded-xl border border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">Nenhum grupo com esses filtros.</p>}
        {report.groups.length>30 && <p className="text-[10px] text-zinc-500">Exibição limitada a 30 grupos por vez. Use a busca ou copie o relatório.</p>}
      </div>}
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Próximo passo: comparar registros no Firebase, verificar pagamento/entrega/rota, confirmar regras publicadas e homologar dois aparelhos. Nenhuma aprovação de produção é inferida desta análise.</p>
    </section>
  );
}
