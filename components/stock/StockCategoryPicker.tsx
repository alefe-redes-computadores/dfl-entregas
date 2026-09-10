// components/stock/StockCategoryPicker.tsx
'use client';
import {useMemo,useState} from 'react';
import {Beef,Boxes,Wheat,Check,CupSoda,Flame,Leaf,Package,Plus,Search,Soup,Sparkles,X,type LucideIcon} from 'lucide-react';
import {useAppStore} from '@/store/useAppStore';
import {DEFAULT_STOCK_CATEGORIES,stockCategoryIconKey,type StockCategoryIconKey} from '@/lib/stock-categories';

const ICONS:Record<StockCategoryIconKey,LucideIcon>={beef:Beef,cup:CupSoda,package:Package,flame:Flame,leaf:Leaf,sparkles:Sparkles,soup:Soup,bread:Wheat,boxes:Boxes};
const norm=(v:string)=>v.trim().toLocaleLowerCase('pt-BR');

export function StockCategoryIcon({category,size=18}:{category?:string;size?:number}){const Icon=ICONS[stockCategoryIconKey(category)];return <Icon size={size}/>}

export function StockCategoryPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const products=useAppStore(s=>s.stockProducts);const [open,setOpen]=useState(false);const [query,setQuery]=useState('');
 const categories=useMemo(()=>{const map=new Map<string,string>();[...DEFAULT_STOCK_CATEGORIES,...products.map(p=>p.category||'')].filter(Boolean).forEach(v=>{const k=norm(v);if(!map.has(k))map.set(k,v.trim())});return [...map.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'))},[products]);
 const filtered=categories.filter(v=>norm(v).includes(norm(query)));const clean=query.trim();const canCreate=clean.length>=2&&!categories.some(v=>norm(v)===norm(clean));
 const choose=(v:string)=>{onChange(v);setQuery('');setOpen(false)};
 return <><button type="button" onClick={()=>setOpen(true)} className="mt-2 flex h-14 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-left focus:border-emerald-500">
  <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><StockCategoryIcon category={value} size={17}/></span>
  <span className={value?'flex-1 text-sm font-bold text-zinc-100':'flex-1 text-sm text-zinc-600'}>{value||'Selecionar categoria'}</span>
 </button>
 {open&&<div className="fixed inset-0 z-[120] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={()=>setOpen(false)}>
  <div className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={e=>e.stopPropagation()}>
   <div className="flex items-center justify-between border-b border-zinc-800 p-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Estoque</p><h2 className="mt-1 font-heading text-lg font-black text-zinc-100">Categoria do produto</h2></div><button type="button" onClick={()=>setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-zinc-500"><X size={18}/></button></div>
   <div className="p-4"><div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ou criar categoria" autoFocus className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-11 pr-4 text-sm text-zinc-100 outline-none focus:border-emerald-500"/></div>
   <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto">
    {canCreate&&<button type="button" onClick={()=>choose(clean)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-emerald-500/35 bg-emerald-500/[.05] p-3 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><Plus size={18}/></span><span className="text-sm font-black text-emerald-300">Criar “{clean}”</span></button>}
    {filtered.map(category=><button type="button" key={category} onClick={()=>choose(category)} className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/55 p-3 text-left active:bg-zinc-800"><span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800 text-zinc-400"><StockCategoryIcon category={category} size={17}/></span><span className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-200">{category}</span>{norm(value)===norm(category)&&<Check size={17} className="text-emerald-400"/>}</button>)}
   </div></div>
  </div>
 </div>}</>
}
