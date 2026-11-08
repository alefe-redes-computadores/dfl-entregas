'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, ClipboardCheck, Save, Search, SkipForward, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { TeamMemberPicker } from '@/components/team/TeamMemberPicker';
import { useAppStore } from '@/store/useAppStore';
import { stockProductCategory, stockCategoryOrder } from '@/lib/stock-categories';
import { formatStockQuantity, normalizeStockQuantityInput } from '@/lib/stock-quantity';
import { reviewStockCountDraft, stockCountDraftState } from '@/lib/operation/stockCountDraft';
import { filterStockCountProducts, purchasedStockIdsToday, type QuickStockFilter } from '@/lib/operation/stock-count-navigation';
import type { TeamMember } from '@/types';

const SESSION = 'dfl-stock-count-session-v2';
const zone = 'America/Sao_Paulo';
const dayKey = (value:string) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(parsed) : '';
};
type CountSession = { values?:Record<string,string>; baseline?:Record<string,number>; reviewed?:Record<string,boolean>; category?:string; quickFilter?:QuickStockFilter; onlyPending?:boolean };
const readSession = ():CountSession => {
  if (typeof window === 'undefined') return {};
  try { const saved = JSON.parse(sessionStorage.getItem(SESSION)||'{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; }
};

export default function CountPage() {
  const router=useRouter();
  const stockProducts=useAppStore(s=>s.stockProducts);
  const supplies=useAppStore(s=>s.stockSupplies);
  const count=useAppStore(s=>s.countStockProducts);
  const products=useMemo(()=>stockProducts.filter(p=>p.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[stockProducts]);
  const [values,setValues]=useState<Record<string,string>>(()=>readSession().values||{});
  const [baseline,setBaseline]=useState<Record<string,number>>(()=>readSession().baseline||{});
  const [reviewed,setReviewed]=useState<Record<string,boolean>>(()=>readSession().reviewed||{});
  const [category,setCategory]=useState(()=>readSession().category||'todas');
  const [quickFilter,setQuickFilter]=useState<QuickStockFilter>(()=>readSession().quickFilter||'todos');
  const [onlyPending,setOnlyPending]=useState(()=>Boolean(readSession().onlyPending));
  const [query,setQuery]=useState(()=>typeof window==='undefined'?'':sessionStorage.getItem(`${SESSION}:query`)||'');
  const [member,setMember]=useState<TeamMember>();
  const [busy,setBusy]=useState(false);
  const refs=useRef<Record<string,HTMLInputElement|null>>({});
  const savingRef=useRef(false);
  const saveRef=useRef<HTMLButtonElement|null>(null);
  const [advanceNotice,setAdvanceNotice]=useState('');
  useEffect(()=>{setValues(v=>({...Object.fromEntries(products.map(p=>[p.id,String(p.current_quantity)])),...v}));},[products]);
  useEffect(()=>{setBaseline(v=>({...Object.fromEntries(products.map(p=>[p.id,p.current_quantity])),...v}));},[products]);
  useEffect(()=>{
    try {
      // O snapshot original continua explícito; os novos filtros pertencem à mesma sessão.
      const baseSnapshot = JSON.stringify({values,baseline});
      const fullSnapshot = {...JSON.parse(baseSnapshot),reviewed,category,quickFilter,onlyPending};
      sessionStorage.setItem(SESSION,JSON.stringify(fullSnapshot));
      sessionStorage.setItem(`${SESSION}:query`,query);
    }
    catch { /* armazenamento local indisponível não pode simular gravação em nuvem */ }
  },[values,baseline,reviewed,category,quickFilter,onlyPending,query]);
  const review=useMemo(()=>reviewStockCountDraft(products,values,baseline),[products,values,baseline]);
  const {changed,conflicts}=review;
  const changedIds=useMemo(()=>new Set(changed.map(p=>p.id)),[changed]);
  const categories=useMemo(()=>[...new Set(products.map(p=>stockProductCategory(p.name,p.category)))].sort((a,b)=>stockCategoryOrder(a)-stockCategoryOrder(b)||a.localeCompare(b,'pt-BR')),[products]);
  const todayKey=dayKey(new Date().toISOString());
  const purchased=useMemo(()=>purchasedStockIdsToday(supplies,todayKey,dayKey),[supplies,todayKey]);
  const groups=useMemo(()=>filterStockCountProducts(products,{query,category,filter:quickFilter,onlyUnreviewed:onlyPending,reviewed,purchasedTodayIds:purchased}),[products,query,category,quickFilter,onlyPending,reviewed,purchased]);
  const filtered=useMemo(()=>groups.flatMap(g=>g.items),[groups]);
  const reviewedCount=useMemo(()=>products.filter(p=>reviewed[p.id]).length,[products,reviewed]);
  const clearSession=()=>{
    try{sessionStorage.removeItem(SESSION);sessionStorage.removeItem(`${SESSION}:query`);}catch{}
    setValues(Object.fromEntries(products.map(p=>[p.id,String(p.current_quantity)])));
    setBaseline(Object.fromEntries(products.map(p=>[p.id,p.current_quantity])));
    setReviewed({});setQuery('');setCategory('todas');setQuickFilter('todos');setOnlyPending(false);
    setAdvanceNotice('Sessão reiniciada.');
  };
  const focusItem=(id:string)=>{
    requestAnimationFrame(()=>{
      const el=refs.current[id];
      el?.focus();el?.scrollIntoView({behavior:'smooth',block:'center'});
    });
  };
  const advance=(currentId:string,skipCategory=false)=>{
    const currentIndex=filtered.findIndex(p=>p.id===currentId);
    if(currentIndex<0)return;
    const currentCategory=stockProductCategory(filtered[currentIndex].name,filtered[currentIndex].category);
    const next=filtered.slice(currentIndex+1).find(p=>!skipCategory||stockProductCategory(p.name,p.category)!==currentCategory);
    if(!skipCategory)setReviewed(prev=>({...prev,[currentId]:true}));
    if(next){setAdvanceNotice(skipCategory?`Categoria ${currentCategory} pulada; continue em ${next.name}.`:`Próximo: ${next.name}.`);focusItem(next.id);return;}
    setAdvanceNotice('Fim do filtro. Revise os dados e conclua a contagem.');
    requestAnimationFrame(()=>saveRef.current?.focus());
  };
  const focusNext=(id:string)=>advance(id);
  const save=async()=>{
    if(savingRef.current)return;
    savingRef.current=true;setBusy(true);
    try{
      const latest=reviewStockCountDraft(products,values,baseline);
      if(latest.conflicts.length)throw new Error(`${latest.conflicts.length} saldo(s) mudou(aram) durante a contagem. Atualize a sessão e confira novamente.`);
      if(latest.changed.length>200)throw new Error('Confira até 200 produtos por vez para manter a contagem atômica.');
      if(latest.changed.length){
        await count(latest.changed.map(p=>{const draft=stockCountDraftState(p.current_quantity,values[p.id],baseline[p.id]);return {product_id:p.id,quantity:draft.quantity,expected_quantity:draft.expectedQuantity}}),member?{id:member.id,name:member.name}:undefined);
      }
      try{sessionStorage.removeItem(SESSION);sessionStorage.removeItem(`${SESSION}:query`);}catch{}
      toast.success(latest.changed.length?`${latest.changed.length} saldo(s) confirmado(s) no servidor.`:'Conferência concluída sem movimentações fictícias.');
      router.replace('/estoque');
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar a contagem.');}
    finally{savingRef.current=false;setBusy(false);}
  };
  return <div className="pb-32">
    <PageHeader title="Contagem rápida" subtitle="Filtros, categorias e conferência sem movimentos fictícios" to="/estoque"/>
    <section className="sticky top-2 z-20 mb-3 rounded-2xl border border-sky-500/20 bg-zinc-950/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-400"><ClipboardCheck size={19}/></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-zinc-100">{reviewedCount}/{products.length} revisados · {changed.length} alterações</p><p className="text-[10px] text-zinc-500">Somente saldos alterados serão gravados. Internet exigida para confirmar.</p></div><button type="button" onClick={clearSession} disabled={busy} className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 text-zinc-500 disabled:opacity-40" aria-label="Limpar sessão"><X size={16}/></button></div>
      {!!advanceNotice&&<p role="status" className="mt-2 text-[10px] text-sky-300">{advanceNotice}</p>}
    </section>
    {conflicts.length>0&&<section role="alert" className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/[.08] p-3 text-xs text-amber-200">{conflicts.length} produto(s) foram alterados por outra operação. Nenhum ajuste será salvo até revisar a sessão.</section>}
    <div className="mb-3"><p className="mb-2 text-xs font-bold text-zinc-400">Responsável <span className="font-normal text-zinc-600">(opcional)</span></p><TeamMemberPicker value={member?.id} onChange={setMember}/></div>
    <div className="relative mb-2"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} inputMode="search" enterKeyHint="next" placeholder="Buscar por produto ou categoria" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-zinc-100 outline-none focus:border-sky-500"/></div>
    <div className="mb-2 grid grid-cols-2 gap-2">
      <label className="relative"><span className="sr-only">Categoria da contagem</span><select value={category} onChange={e=>setCategory(e.target.value)} className="h-12 w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 pr-8 text-xs font-bold text-zinc-200"><option value="todas">Todas categorias</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-4 text-zinc-500" size={14}/></label>
      <label className="relative"><span className="sr-only">Filtro da contagem</span><select value={quickFilter} onChange={e=>setQuickFilter(e.target.value as QuickStockFilter)} className="h-12 w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 pr-8 text-xs font-bold text-zinc-200"><option value="todos">Todos os saldos</option><option value="zerados">Zerados</option><option value="minimo">No mínimo</option><option value="alto">Estoque alto</option><option value="compra_hoje">Em compras de hoje</option></select><ChevronDown className="pointer-events-none absolute right-2 top-4 text-zinc-500" size={14}/></label>
    </div>
    <div className="mb-3 flex items-center justify-between gap-2"><span role="status" className="text-[10px] text-zinc-500">{filtered.length} produto(s) no filtro</span><button type="button" aria-pressed={onlyPending} onClick={()=>setOnlyPending(p=>!p)} className={`min-h-10 rounded-xl border px-3 text-[10px] font-black ${onlyPending?'border-sky-500/40 bg-sky-500/10 text-sky-300':'border-zinc-800 text-zinc-400'}`}>{onlyPending?'Só não conferidos':'Mostrar não conferidos'}</button></div>
    <div className="space-y-3">{groups.map(group=><section key={group.category} aria-label={`Contagem: ${group.category}`} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/35">
      <div className="flex items-center justify-between gap-2 bg-zinc-900/75 p-3"><div className="min-w-0"><h2 className="truncate text-xs font-black text-zinc-100">{group.category}</h2><p className="mt-1 text-[10px] text-zinc-500">{group.items.length} itens neste filtro</p></div><button type="button" disabled={busy} onClick={()=>advance(group.items[0].id,true)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-sky-500/20 px-3 text-[10px] font-bold text-sky-300"><SkipForward size={14}/> Pular categoria</button></div>
      {group.items.map((p,index)=>{const changedNow=changedIds.has(p.id);const isReviewed=reviewed[p.id]===true;return <div key={p.id} className={`flex items-center gap-2 border-t border-zinc-800/60 p-3 ${changedNow?'bg-sky-500/[.045]':''}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-black ${isReviewed?'bg-emerald-500/15 text-emerald-300':'bg-zinc-950 text-zinc-600'}`}>{isReviewed?<Check size={15}/>:index+1}</span><label className="min-w-0 flex-1"><b className="block truncate text-xs text-zinc-200">{p.name}</b><small className="text-[10px] text-zinc-500">Saldo {formatStockQuantity(p.current_quantity,p.unit)}</small></label><input ref={el=>{refs.current[p.id]=el}} aria-label={`Saldo conferido de ${p.name}`} inputMode="decimal" value={stockCountDraftState(p.current_quantity,values[p.id],baseline[p.id]).display} onFocus={e=>{const draft=stockCountDraftState(p.current_quantity,values[p.id],baseline[p.id]);if(!draft.touched){setBaseline(v=>({...v,[p.id]:p.current_quantity}));setValues(v=>({...v,[p.id]:String(p.current_quantity)}));}e.currentTarget.select();}} onChange={e=>setValues(v=>({...v,[p.id]:e.target.value.replace(/[^0-9.,]/g,'')}))} onBlur={e=>{if(e.target.value.trim())setValues(v=>({...v,[p.id]:normalizeStockQuantityInput(e.target.value)}));}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();focusNext(p.id);}}} className="h-11 w-[88px] rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-right text-sm font-black text-zinc-100 outline-none focus:border-sky-500"/><button type="button" disabled={busy} aria-label={`Conferir ${p.name} e próximo`} onClick={()=>advance(p.id)} className="grid h-11 w-9 shrink-0 place-items-center rounded-xl border border-emerald-500/20 text-emerald-300"><Check size={17}/></button></div>;})}
    </section>)}</div>
    {!groups.length&&<p role="status" className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-xs text-zinc-500">Nenhum produto neste filtro. Remova filtros ou selecione outra categoria.</p>}
    <div className="fixed inset-x-0 bottom-[82px] z-40 mx-auto w-[calc(100%-24px)] max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur"><button ref={saveRef} type="button" onClick={()=>void save()} disabled={busy||conflicts.length>0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3.5 font-black text-zinc-950 disabled:opacity-40"><Save size={18}/>{busy?'Salvando...':changed.length?`Salvar ${changed.length} alteração${changed.length===1?'':'ões'}`:'Concluir sem alterações'}</button></div>
  </div>;
}
