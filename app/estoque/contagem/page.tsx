'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,ClipboardCheck,Save,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {PageHeader} from '@/components/layout/PageHeader';
import {TeamMemberPicker} from '@/components/team/TeamMemberPicker';
import {useAppStore} from '@/store/useAppStore';
import type {TeamMember} from '@/types';
import {formatStockQuantity,normalizeStockQuantityInput,parseStockQuantityInput} from '@/lib/stock-quantity';

const SESSION='dfl-stock-count-session-v2';

export default function CountPage(){
 const router=useRouter();
 const products=useAppStore(s=>s.stockProducts.filter(p=>p.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
 const count=useAppStore(s=>s.countStockProducts);
 const [values,setValues]=useState<Record<string,string>>(()=>{if(typeof window!=='undefined'){try{const saved=JSON.parse(sessionStorage.getItem(SESSION)||'{}');if(saved.values)return saved.values}catch{}}return{}});
 const [query,setQuery]=useState(()=>typeof window==='undefined'?'':sessionStorage.getItem(`${SESSION}:query`)||'');
 const [member,setMember]=useState<TeamMember>();
 const [busy,setBusy]=useState(false);
 const [onlyPending,setOnlyPending]=useState(false);
 const refs=useRef<Record<string,HTMLInputElement|null>>({});
 useEffect(()=>{setValues(v=>({...Object.fromEntries(products.map(p=>[p.id,String(p.current_quantity)])),...v}))},[products]);
 useEffect(()=>{sessionStorage.setItem(SESSION,JSON.stringify({values}));sessionStorage.setItem(`${SESSION}:query`,query)},[values,query]);
 const changed=products.filter(p=>parseStockQuantityInput(values[p.id]??String(p.current_quantity))!==p.current_quantity);
 const changedIds=useMemo(()=>new Set(changed.map(p=>p.id)),[changed]);
 const filtered=useMemo(()=>products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))&&(!onlyPending||!changedIds.has(p.id))),[products,query,onlyPending,changedIds]);
 const clearSession=()=>{sessionStorage.removeItem(SESSION);sessionStorage.removeItem(`${SESSION}:query`);setValues(Object.fromEntries(products.map(p=>[p.id,String(p.current_quantity)])));setQuery('')};
 const save=async()=>{setBusy(true);try{await count(changed.map(p=>({product_id:p.id,quantity:parseStockQuantityInput(values[p.id]??String(p.current_quantity))})),member?{id:member.id,name:member.name}:undefined);sessionStorage.removeItem(SESSION);sessionStorage.removeItem(`${SESSION}:query`);toast.success(`${changed.length} saldo${changed.length===1?'':'s'} conferido${changed.length===1?'':'s'}.`);router.replace('/estoque')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar a contagem.');setBusy(false)}};
 const focusNext=(id:string)=>{const i=filtered.findIndex(p=>p.id===id);const next=filtered[i+1];if(next){refs.current[next.id]?.focus();refs.current[next.id]?.scrollIntoView({behavior:'smooth',block:'center'})}};
 return <div className="pb-32">
  <PageHeader title="Contagem rápida" subtitle="Confira em sequência sem sair da tela" to="/estoque"/>
  <section className="sticky top-2 z-20 mb-4 rounded-2xl border border-sky-500/20 bg-zinc-950/95 p-3 shadow-xl backdrop-blur"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-400"><ClipboardCheck size={19}/></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-zinc-100">{changed.length} alteração{changed.length===1?'':'ões'} pronta{changed.length===1?'':'s'}</p><p className="text-[9px] text-zinc-500">A sessão fica neste aparelho até salvar ou limpar.</p></div>{Object.keys(values).length>0&&<button type="button" onClick={clearSession} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-500" aria-label="Limpar sessão"><X size={15}/></button>}</div></section>
  <div className="mb-3"><p className="mb-2 text-xs font-bold text-zinc-400">Responsável <span className="font-normal text-zinc-600">(opcional)</span></p><TeamMemberPicker value={member?.id} onChange={setMember}/></div>
  <div className="relative mb-3"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-zinc-100 outline-none focus:border-sky-500"/></div>
  <button type="button" onClick={()=>setOnlyPending(v=>!v)} className={`mb-3 rounded-xl border px-3 py-2 text-[10px] font-black ${onlyPending?'border-sky-500/40 bg-sky-500/10 text-sky-300':'border-zinc-800 text-zinc-500'}`}>{onlyPending?'Mostrando próximos a conferir':'Mostrar só próximos a conferir'}</button>
  <div className="space-y-2">{filtered.map((p,index)=>{const changedNow=changedIds.has(p.id);return <label key={p.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${changedNow?'border-sky-500/30 bg-sky-500/[.055]':'border-zinc-800 bg-zinc-900/50'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-black ${changedNow?'bg-sky-500 text-zinc-950':'bg-zinc-950 text-zinc-600'}`}>{changedNow?<Check size={15}/>:index+1}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-zinc-200">{p.name}</b><small className="text-zinc-600">Atual {formatStockQuantity(p.current_quantity,p.unit)}</small></span><input ref={el=>{refs.current[p.id]=el}} inputMode="decimal" value={values[p.id]??String(p.current_quantity)} onFocus={e=>e.currentTarget.select()} onChange={e=>setValues(v=>({...v,[p.id]:e.target.value.replace(/[^0-9.,]/g,'')}))} onBlur={e=>{if(e.target.value.trim())setValues(v=>({...v,[p.id]:normalizeStockQuantityInput(e.target.value)}))}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();focusNext(p.id)}}} className="h-11 w-24 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-right font-black text-zinc-100 outline-none focus:border-sky-500"/></label>})}</div>
  {!filtered.length&&<p className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-xs text-zinc-600">Nenhum produto neste filtro.</p>}
  <div className="fixed inset-x-0 bottom-[82px] z-40 mx-auto w-[calc(100%-24px)] max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur"><button type="button" onClick={save} disabled={busy||!changed.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3.5 font-black text-zinc-950 disabled:opacity-40"><Save size={18}/>{busy?'Salvando...':changed.length?`Salvar ${changed.length} alteração${changed.length===1?'':'ões'}`:'Nenhuma alteração'}</button></div>
 </div>
}