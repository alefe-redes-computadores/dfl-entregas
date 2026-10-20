'use client';
import {useEffect,useMemo,useState} from 'react';
import {AlertOctagon,AlertTriangle,ChevronDown,ChevronRight,Lightbulb,Wrench,X} from 'lucide-react';
import {stockCatalogIssues} from '@/lib/stock-catalog-health';
import {readStockUiStorage,writeStockUiStorage,removeStockUiStorage} from '@/lib/stock-local-ui-storage';
import type {StockProduct} from '@/types';
const STORAGE_KEY='dfl-stock-catalog-ignored-v852';
export function StockCatalogHealth({products,onOpen}:{products:StockProduct[];onOpen:(id:string)=>void}){
 const issues=useMemo(()=>stockCatalogIssues(products),[products]);
 const [open,setOpen]=useState(false);const[showAll,setShowAll]=useState(false);
 const [ignored,setIgnored]=useState<string[]>([]);
 useEffect(()=>{try{const raw=JSON.parse(readStockUiStorage('local',STORAGE_KEY)||'[]');if(Array.isArray(raw))setIgnored(raw.filter((x):x is string=>typeof x==='string'));}catch{}},[]);
 const key=(id:string,title:string)=>`${id}:${title}`;
 const visible=issues.filter(item=>item.severity==='critical'||!ignored.includes(key(item.productId,item.title)));
 const critical=visible.filter(item=>item.severity==='critical').length;
 const attention=visible.filter(item=>item.severity==='attention').length;
 const hidden=issues.length-visible.length;
 const dismiss=(id:string,title:string)=>{const next=Array.from(new Set([...ignored,key(id,title)]));setIgnored(next);try{writeStockUiStorage('local',STORAGE_KEY,JSON.stringify(next))}catch{}};
 if(!issues.length)return null;
 return <section className="overflow-hidden rounded-[22px] border border-amber-500/20 bg-amber-500/[.045]">
  <button type="button" onClick={()=>setOpen(value=>!value)} className="flex w-full items-center gap-3 p-4 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400">{critical?<AlertOctagon size={18}/>:<Wrench size={18}/>}</span><span className="min-w-0 flex-1"><b className="block text-xs text-zinc-100">Revisão inteligente do cadastro</b><span className="mt-1 block text-[10px] text-zinc-500">{critical} crítico(s) · {attention} em atenção · {hidden} ignorado(s)</span></span>{open?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>
  {open&&<div className="border-t border-amber-500/10 p-3"><p className="mb-3 text-[10px] text-zinc-500">A revisão é orientativa: nada é alterado sozinho. Alertas críticos não podem ser ocultados.</p><div className="space-y-2">{visible.slice(0,showAll?undefined:5).map((item,index)=>{const Icon=item.severity==='critical'?AlertOctagon:item.severity==='attention'?AlertTriangle:Lightbulb;return <div key={`${item.productId}-${item.title}-${index}`} className={`flex items-start gap-2 rounded-xl border p-3 ${item.severity==='critical'?'border-red-500/25 bg-red-500/5':'border-amber-500/15 bg-zinc-950/50'}`}><Icon size={15} className="mt-0.5 shrink-0 text-amber-400"/><button type="button" onClick={()=>onOpen(item.productId)} className="min-w-0 flex-1 text-left"><b className="block text-[11px] text-zinc-200">{item.productName} · {item.title}</b><span className="mt-1 block text-[10px] text-zinc-500">{item.impact}</span><span className="mt-1 block text-[10px] text-zinc-400">Sugestão: {item.action}</span></button>{item.severity!=='critical'&&<button type="button" aria-label={`Ignorar ${item.title} de ${item.productName}`} onClick={()=>dismiss(item.productId,item.title)} className="rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">Ignorar</button>}</div>})}</div>
  {visible.length>5&&<button type="button" onClick={()=>setShowAll(v=>!v)} className="mt-3 w-full rounded-xl border border-zinc-700 p-3 text-xs font-bold text-zinc-300">{showAll?'Mostrar menos':`Ver todos (${visible.length})`}</button>}
  {hidden>0&&<button type="button" onClick={()=>{setIgnored([]);try{removeStockUiStorage('local',STORAGE_KEY)}catch{}}} className="mt-2 w-full text-center text-[10px] text-zinc-500">Restaurar {hidden} recomendação(ões) ignorada(s)</button>}
  </div>}
 </section>;
}
