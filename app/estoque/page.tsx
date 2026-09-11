// app/estoque/page.tsx
'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, BadgeDollarSign, BarChart3, Boxes, ChevronDown, ChevronLeft, ClipboardCheck, History, ListChecks, PackagePlus, Search, Store, Wallet, WandSparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { stockLevel, stockProductValue, stockValue } from '@/lib/stock';
import { buildStockRecommendations, stockIntelligenceSummary } from '@/lib/stock-intelligence';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import type { StockProduct } from '@/types';

export default function StockPage() {
  const router=useRouter(); const products=useAppStore(s=>s.stockProducts); const movements=useAppStore(s=>s.stockMovements);
  const [query,setQuery]=useState(''); const [filter,setFilter]=useState<'todos'|'baixo'|'zero'>('todos'); const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const active=useMemo(()=>products.filter(p=>p.active),[products]);
  const stockBrain=useMemo(()=>stockIntelligenceSummary(active,movements),[active,movements]);
  const recommendationMap=useMemo(()=>new Map(buildStockRecommendations(active,movements).map(item=>[item.productId,item])),[active,movements]);
  const suggested=useMemo(()=>active.filter(p=>(recommendationMap.get(p.id)?.recommendedQuantity||0)>0).sort(prioritySort),[active,recommendationMap]);
  const visible=useMemo(()=>active.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))&&(filter==='todos'||stockLevel(p)===filter)).sort(prioritySort),[active,filter,query]);
  const groups=useMemo(()=>Object.entries(visible.reduce<Record<string,StockProduct[]>>((all,p)=>{const key=p.category?.trim()||'Sem categoria';(all[key]||=[]).push(p);return all},{})).sort(([a],[b])=>a.localeCompare(b,'pt-BR')),[visible]);
  const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return <div className="flex flex-col gap-5 pb-28">
    <header className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={()=>router.replace('/loja')} className="grid h-12 w-12 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400"><ChevronLeft size={21}/></button><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-400">Controle físico</p><h1 className="font-heading text-2xl font-black text-zinc-100">Estoque</h1></div></div></header>
    <section className="grid grid-cols-2 gap-2">
      <CompactMetric label="Produtos ativos" value={String(active.length)} />
      <CompactMetric label="Pedem atenção" value={String(suggested.length)} alert={suggested.length>0} />
      <CompactMetric label="Valor estimado" value={money(stockValue(active))} />
      <CompactMetric label="Movimentações" value={String(movements.length)} />
    </section>
    <section className="grid grid-cols-4 gap-2"><Shortcut icon={ClipboardCheck} label="Contagem" color="text-sky-400" onClick={()=>router.push('/estoque/contagem')}/><Shortcut icon={ListChecks} label="Comprar" color="text-amber-400" onClick={()=>router.push('/estoque/compras')}/><Shortcut icon={BarChart3} label="Relatórios" color="text-emerald-400" onClick={()=>router.push('/estoque/relatorios')}/><Shortcut icon={Archive} label="Arquivados" color="text-zinc-400" onClick={()=>router.push('/estoque/arquivados')}/><Shortcut icon={Store} label="Fornecedores" color="text-orange-400" onClick={()=>router.push('/estoque/fornecedores')}/><Shortcut icon={BadgeDollarSign} label="Preços" color="text-lime-400" onClick={()=>router.push('/estoque/precos')}/><Shortcut icon={WandSparkles} label="Catálogo" color="text-violet-400" onClick={()=>router.push('/estoque/catalogo')}/></section>
    {suggested.length>0&&<section className="rounded-[22px] border border-amber-500/25 bg-amber-500/[.055] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-amber-400">Reposição inteligente</p>
          <p className="mt-1 text-[10px] text-zinc-500">{suggested.length} {suggested.length===1?'produto pede':'produtos pedem'} reposição · {stockBrain.historyBacked} com histórico suficiente</p>
        </div>
        <button onClick={()=>router.push('/estoque/compras')} className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-black text-zinc-950">Montar compra</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {suggested.slice(0,4).map(p=>{const rec=recommendationMap.get(p.id)!;return <div key={p.id} className="rounded-xl bg-zinc-950/50 px-3 py-2">
          <p className="truncate text-[10px] font-bold text-zinc-300">{p.name}</p>
          <p className="mt-0.5 text-[9px] font-black text-amber-400">Comprar {rec.recommendedQuantity.toLocaleString('pt-BR',{maximumFractionDigits:2})} {shortUnit(p)}</p>
          <p className="mt-1 truncate text-[8px] text-zinc-600">{rec.usesHistory?`Média ${rec.averageDailyConsumption.toLocaleString('pt-BR',{maximumFractionDigits:2})}/dia · confiança ${rec.confidence}`:'Regra configurada · histórico insuficiente'}</p>
        </div>})}
      </div>
      {stockBrain.withoutSafetyStock>0&&<p className="mt-3 text-[9px] font-bold text-amber-300/80">{stockBrain.withoutSafetyStock} produto{stockBrain.withoutSafetyStock===1?' está':'s estão'} sem estoque de segurança configurado.</p>}
      {suggested.length>4&&<p className="mt-2 text-[9px] font-bold text-zinc-600">+ {suggested.length-4} outros produtos</p>}
    </section>}
    <div className="relative"><Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-zinc-100 outline-none focus:border-emerald-500"/></div>
    <div className="grid grid-cols-3 gap-2">{(['todos','baixo','zero'] as const).map(key=><button key={key} onClick={()=>setFilter(key)} className={`h-11 rounded-xl border text-xs font-bold ${filter===key?'border-emerald-500/40 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{key==='todos'?'Todos':key==='baixo'?'Baixo':'Zerado'}</button>)}</div>
    <section className="space-y-3">{groups.map(([category,items])=>{const attention=items.filter(p=>stockLevel(p)!=='ok').length;const isCollapsed=Boolean(collapsed[category]);return <section key={category} className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/35"><button onClick={()=>setCollapsed(v=>({...v,[category]:!v[category]}))} className="flex w-full items-center gap-3 p-4 text-left"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><Boxes size={16}/></span><div className="min-w-0 flex-1"><h2 className="truncate font-heading text-sm font-black text-zinc-200">{category}</h2><p className="mt-0.5 text-[9px] text-zinc-600">{items.length} {items.length===1?'produto':'produtos'}{attention?` · ${attention} em atenção`:''}</p></div><ChevronDown size={17} className={`text-zinc-600 transition-transform ${isCollapsed?'-rotate-90':''}`}/></button>{!isCollapsed&&<div className="border-t border-zinc-800/70">{items.map(product=><ProductRow key={product.id} product={product} open={()=>router.push(`/estoque/detalhes?id=${product.id}`)} move={()=>router.push(`/estoque/movimentar?id=${product.id}`)}/>)}</div>}</section>})}{!groups.length&&<div className="rounded-[28px] border border-dashed border-zinc-800 py-14 text-center"><PackagePlus size={34} className="mx-auto text-zinc-700"/><p className="mt-3 text-sm font-bold text-zinc-400">Nenhum produto encontrado</p></div>}</section>
  </div>;
}
function CompactMetric({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div className={`rounded-2xl border px-3.5 py-3 ${alert?'border-amber-500/25 bg-amber-500/[.055]':'border-zinc-800 bg-zinc-900/45'}`}><p className={`text-[9px] font-bold ${alert?'text-amber-400':'text-zinc-600'}`}>{label}</p><p className="mt-1 truncate text-base font-black text-zinc-100">{value}</p></div>}
const prioritySort=(a:StockProduct,b:StockProduct)=>{const rank={zero:0,baixo:1,ok:2};return rank[stockLevel(a)]-rank[stockLevel(b)]||a.name.localeCompare(b.name,'pt-BR')};
const shortUnit=(p:StockProduct)=>SUPPLY_UNIT_LABELS[p.unit].toLocaleLowerCase('pt-BR');
function ProductRow({product,open,move}:{product:StockProduct;open:()=>void;move:()=>void}){const level=stockLevel(product);return <article onClick={open} className="flex cursor-pointer items-center gap-3 border-b border-zinc-800/60 p-3.5 last:border-0"><div className={`h-10 w-1 rounded-full ${level==='ok'?'bg-emerald-500':level==='zero'?'bg-red-500':'bg-amber-500'}`}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-zinc-200">{product.name}</p>{level!=='ok'&&<span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${level==='zero'?'bg-red-500/10 text-red-400':'bg-amber-500/10 text-amber-400'}`}>{level==='zero'?'Zerado':'Baixo'}</span>}</div><p className="mt-1 text-[10px] text-zinc-600"><b className="text-zinc-300">{product.current_quantity.toLocaleString('pt-BR')}</b> {shortUnit(product)} · alerta {product.minimum_quantity.toLocaleString('pt-BR')} · repor até {Math.max(product.minimum_quantity,product.ideal_quantity||0).toLocaleString('pt-BR')}</p>{Boolean(product.average_cost)&&<p className="mt-1 text-[9px] text-zinc-600">Custo médio {product.average_cost!.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/{shortUnit(product)} · <b className="text-emerald-400">{stockProductValue(product).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b> no estoque</p>}</div><button onClick={e=>{e.stopPropagation();move()}} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400" aria-label={`Movimentar ${product.name}`}><ClipboardCheck size={17}/></button></article>}
function Metric({icon:Icon,label,value,alert}:{icon:typeof Boxes;label:string;value:string;alert?:boolean}){return <div className={`min-w-0 rounded-[22px] border p-4 ${alert?'border-amber-500/25 bg-amber-500/[.05]':'border-zinc-800 bg-zinc-900/45'}`}><Icon size={16} className={alert?'text-amber-400':'text-emerald-400'}/><p className="mt-3 truncate font-heading text-xl font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] font-bold text-zinc-600">{label}</p></div>}
function Shortcut({icon:Icon,label,color,onClick}:{icon:typeof Boxes;label:string;color:string;onClick:()=>void}){return <button onClick={onClick} className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3 text-left"><Icon size={17} className={color}/><p className="mt-2 truncate text-[9px] font-black text-zinc-300">{label}</p></button>}
