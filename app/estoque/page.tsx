// app/estoque/page.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, BadgeDollarSign, BarChart3, Boxes, ChevronDown, ChevronLeft, ClipboardCheck, History, ListChecks, PackagePlus, Search, Store, Wallet, WandSparkles, SlidersHorizontal, X, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { stockLevel, stockProductValue, stockValue } from '@/lib/stock';
import { buildStockRecommendations, stockIntelligenceSummary } from '@/lib/stock-intelligence';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { stockCategoryOrder, stockProductCategory, stockCategoryTone } from '@/lib/stock-categories';
import { StockCategoryIcon } from '@/components/stock/StockCategoryPicker';
import { StockCriticalBanner } from '@/components/stock/StockCriticalBanner';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { commercialPurchasePlan, committedStockQuantityMap } from '@/lib/stock-shopping';
import { formatCommercialPlan } from '@/lib/stock-commercial';
import { humanPurchasePlan, naturalStockNameCompare, physicalStockDisplay } from '@/lib/stock-commercial-display-v2';
import { buildDailyStockSignal } from '@/lib/stock-daily-plan';
import { commercialCoverage } from '@/lib/stock-commercial-health';
import type { StockProduct } from '@/types';

export default function StockPage() {
  const router=useRouter(); const products=useAppStore(s=>s.stockProducts); const movements=useAppStore(s=>s.stockMovements);const supplies=useAppStore(s=>s.stockSupplies);const committedMap=useMemo(()=>committedStockQuantityMap(supplies),[supplies]);
  const [query,setQuery]=useState(''); const [searchOpen,setSearchOpen]=useState(false); const [filterOpen,setFilterOpen]=useState(false);
  const [filter,setFilter]=useState<'todos'|'baixo'|'zero'>(()=>typeof window==='undefined'?'todos':((localStorage.getItem('dfl-stock-filter') as 'todos'|'baixo'|'zero')||'todos'));
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>(()=>{if(typeof window==='undefined')return{};try{return JSON.parse(localStorage.getItem('dfl-stock-collapsed')||'{}')}catch{return{}}});
  const restoredScroll=useRef(false);
  useEffect(()=>{localStorage.setItem('dfl-stock-filter',filter)},[filter]);
  useEffect(()=>{localStorage.setItem('dfl-stock-collapsed',JSON.stringify(collapsed))},[collapsed]);
  useEffect(()=>{if(restoredScroll.current)return;restoredScroll.current=true;const y=Number(sessionStorage.getItem('dfl-stock-scroll')||0);if(y>0)requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'auto'}))},[]);
  useEffect(()=>{const save=()=>sessionStorage.setItem('dfl-stock-scroll',String(window.scrollY));window.addEventListener('scroll',save,{passive:true});return()=>window.removeEventListener('scroll',save)},[]);
  const active=useMemo(()=>products.filter(p=>p.active),[products]);
  const commercialHealth=useMemo(()=>commercialCoverage(active),[active]);
  const stockBrain=useMemo(()=>stockIntelligenceSummary(active,movements),[active,movements]);
  const recommendationMap=useMemo(()=>new Map(buildStockRecommendations(active,movements).map(item=>[item.productId,item])),[active,movements]);
  const suggested=useMemo(()=>active.filter(p=>{const r=recommendationMap.get(p.id);if(!r)return false;const configured=Math.max(Number(p.minimum_quantity)||0,Number(p.ideal_quantity)||0)>0;return r.recommendedQuantity>0&&(configured||r.usesHistory)}).sort(prioritySort),[active,recommendationMap]);
  const commercialMissing=useMemo(()=>active.filter(p=>commercialCoverage([p]).attention>0),[active]);
  const daily=useMemo(()=>active.map(p=>({p,signal:buildDailyStockSignal(p,movements)})).filter(x=>x.signal.suggested>0&&(Math.max(x.p.minimum_quantity,x.p.ideal_quantity||0)>0||x.signal.usesWeekday)).sort((a,b)=>b.signal.suggested-a.signal.suggested),[active,movements]);
  const visible=useMemo(()=>active.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))&&(filter==='todos'||stockLevel(p)===filter)).sort(prioritySort),[active,filter,query]);
  const groups=useMemo(()=>Object.entries(visible.reduce<Record<string,StockProduct[]>>((all,p)=>{const key=stockProductCategory(p.name,p.category);(all[key]||=[]).push(p);return all},{})).map(([category,items])=>[category,[...items].sort((a,b)=>naturalStockNameCompare(a.name,b.name))] as [string,StockProduct[]]).sort(([a],[b])=>stockCategoryOrder(a)-stockCategoryOrder(b)||a.localeCompare(b,'pt-BR')),[visible]);
  const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return <div className="dfl-page">
    <header className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={()=>router.replace('/loja')} className="grid h-12 w-12 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400"><ChevronLeft size={21}/></button><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-400">Controle físico</p><h1 className="font-heading text-2xl font-black text-zinc-100">Estoque</h1></div></div></header>
    <StockCriticalBanner products={active} />
    <section className="grid grid-cols-2 gap-2">
      <CompactMetric label="Produtos ativos" value={String(active.length)} />
      <CompactMetric label="Pedem atenção" value={String(suggested.length)} alert={suggested.length>0} />
      <CompactMetric label="Valor estimado" value={money(stockValue(active))} />
      <CompactMetric label="Movimentações" value={String(movements.length)} />
    </section>
    <section className="grid grid-cols-2 gap-2"><Shortcut icon={ClipboardCheck} label="Contagem" color="text-sky-400" onClick={()=>router.push('/estoque/contagem')}/><Shortcut icon={ListChecks} label="Comprar" color="text-amber-400" onClick={()=>router.push('/estoque/compras')}/><Shortcut icon={BarChart3} label="Relatórios" color="text-emerald-400" onClick={()=>router.push('/estoque/relatorios')}/><Shortcut icon={Archive} label="Arquivados" color="text-zinc-400" onClick={()=>router.push('/estoque/arquivados')}/><Shortcut icon={Store} label="Fornecedores" color="text-orange-400" onClick={()=>router.push('/estoque/fornecedores')}/><Shortcut icon={BadgeDollarSign} label="Preços" color="text-lime-400" onClick={()=>router.push('/estoque/precos')}/><Shortcut icon={WandSparkles} label="Catálogo" color="text-violet-400" onClick={()=>router.push('/estoque/catalogo')}/></section>
    {commercialHealth.attention>0&&<button type="button" onClick={()=>router.push(commercialMissing.length===1?`/estoque/editar?id=${commercialMissing[0].id}&from=estoque`:'/estoque?commercial=missing')} className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-sky-500/15 bg-sky-500/[.035] p-3.5 text-left active:scale-[.99]"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-sky-400">Formas de compra</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{commercialHealth.attention===1?`${commercialMissing[0]?.name||'1 produto'} precisa informar a embalagem real.`:`${commercialHealth.attention} produtos precisam informar a embalagem real.`}</p></div><ChevronLeft size={17} className="shrink-0 rotate-180 text-sky-400"/></button>}
    {suggested.length>0&&<section className="rounded-[22px] border border-amber-500/25 bg-amber-500/[.055] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-amber-400">Reposição inteligente</p>
          <p className="mt-1 text-[10px] text-zinc-500">{suggested.length} {suggested.length===1?'produto pede':'produtos pedem'} reposição · {stockBrain.historyBacked} com histórico suficiente</p>
        </div>
        <button onClick={()=>router.push('/estoque/compras')} className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-black text-zinc-950">Montar compra</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {suggested.slice(0,4).map(p=>{const rec=recommendationMap.get(p.id)!;return <button type="button" key={p.id} onClick={()=>router.push(`/estoque/detalhes?id=${p.id}`)} className="rounded-xl bg-zinc-950/50 px-3 py-2 text-left transition active:scale-[.98] active:bg-zinc-900">
          <p className="truncate text-[10px] font-bold text-zinc-300">{p.name}</p>
          <p className="mt-0.5 text-[9px] font-black text-amber-400">Comprar {(()=>{const plan=commercialPurchasePlan(p,rec.recommendedQuantity,committedMap.get(p.id)||0);return humanPurchasePlan({purchaseQuantity:plan.purchaseQuantity,baseQuantity:plan.baseQuantity,baseUnit:p.unit,presentation:plan.presentation})})()}</p>
          <p className="mt-1 truncate text-[8px] text-zinc-600">{rec.minimumReached?'Mínimo atingido agora':rec.daysUntilMinimum!==null?`~${rec.daysUntilMinimum.toLocaleString('pt-BR',{maximumFractionDigits:1})} dias até o mínimo · confiança ${rec.confidence}`:'Regra configurada · histórico insuficiente'}</p>
        </button>})}
      </div>
      {stockBrain.withoutSafetyStock>0&&<p className="mt-3 text-[9px] font-bold text-amber-300/80">{stockBrain.withoutSafetyStock} produto{stockBrain.withoutSafetyStock===1?' está':'s estão'} sem estoque de segurança configurado.</p>}
      {suggested.length>4&&<p className="mt-2 text-[9px] font-bold text-zinc-600">+ {suggested.length-4} outros produtos</p>}
    </section>}
    {daily.length>0&&<section className="rounded-[22px] border border-emerald-500/15 bg-emerald-500/[.035] p-4"><div className="flex items-center gap-2"><CalendarDays size={16} className="text-emerald-400"/><div><p className="text-xs font-black text-zinc-100">Compra do dia</p><p className="text-[9px] text-zinc-500">Sugestão contextual pelo consumo deste dia da semana; sem amostra, mantém sua meta.</p></div></div><div className="mt-3 grid grid-cols-2 gap-2">{daily.slice(0,4).map(({p,signal})=><button key={p.id} onClick={()=>router.push(`/estoque/detalhes?id=${p.id}&from=estoque`)} className="rounded-xl bg-zinc-950/45 p-3 text-left"><p className="truncate text-[10px] font-black text-zinc-300">{p.name}</p><p className="mt-1 text-[9px] font-black text-emerald-400">{formatStockQuantity(signal.suggested,p.unit)} sugerido</p><p className="mt-1 text-[8px] text-zinc-600">{signal.usesWeekday?`${signal.weekdaySamples} dias equivalentes · confiança ${signal.confidence}`:'Meta configurada · histórico insuficiente'}</p></button>)}</div></section>}
    <div className="flex gap-2"><button type="button" onClick={()=>setSearchOpen(v=>!v)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${searchOpen||query?'border-emerald-500/30 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}><Search size={18}/></button>{searchOpen&&<div className="relative min-w-0 flex-1"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto…" className="dfl-search h-11 pr-10"/>{query&&<button onClick={()=>setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"><X size={15}/></button>}</div>}<button type="button" onClick={()=>setFilterOpen(v=>!v)} className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-[10px] font-black ${filter!=='todos'?'border-emerald-500/30 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}><SlidersHorizontal size={16}/>{filter==='todos'?'Filtros':filter==='baixo'?'Baixo':'Zerado'}</button></div>
    {filterOpen&&<div className="flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-2">{(['todos','baixo','zero'] as const).map(key=><button key={key} onClick={()=>{setFilter(key);setFilterOpen(false)}} className={`h-9 flex-1 rounded-xl text-[10px] font-black ${filter===key?'bg-emerald-500/10 text-emerald-400':'text-zinc-500'}`}>{key==='todos'?'Todos':key==='baixo'?'Baixo':'Zerado'}</button>)}</div>}
    <section className="space-y-3">{groups.map(([category,items])=>{const attention=items.filter(p=>stockLevel(p)!=='ok').length;const isCollapsed=Boolean(collapsed[category]);return <section key={category} className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/35"><button onClick={()=>setCollapsed(v=>({...v,[category]:!v[category]}))} className="flex w-full items-center gap-3 p-4 text-left"><span className={`grid h-9 w-9 place-items-center rounded-xl ${categoryToneClasses(stockCategoryTone(category))}`}><StockCategoryIcon category={category} size={16}/></span><div className="min-w-0 flex-1"><h2 className="truncate font-heading text-sm font-black text-zinc-200">{category}</h2><p className="mt-0.5 text-[9px] text-zinc-600">{items.length} {items.length===1?'produto':'produtos'}{attention?` · ${attention} em atenção`:''}</p></div><ChevronDown size={17} className={`text-zinc-600 transition-transform ${isCollapsed?'-rotate-90':''}`}/></button>{!isCollapsed&&<div className="border-t border-zinc-800/70">{items.map(product=><ProductRow key={product.id} product={product} open={()=>router.push(`/estoque/detalhes?id=${product.id}`)} move={()=>router.push(`/estoque/movimentar?id=${product.id}`)}/>)}</div>}</section>})}{!groups.length&&<div className="dfl-empty"><PackagePlus size={34} className="mx-auto text-zinc-700"/><p className="mt-3 text-sm font-bold text-zinc-400">Nenhum produto encontrado</p></div>}</section>
  </div>;
}
const categoryToneClasses=(tone:ReturnType<typeof stockCategoryTone>)=>({
  rose:'bg-rose-500/10 text-rose-400',
  amber:'bg-amber-500/10 text-amber-400',
  sky:'bg-sky-500/10 text-sky-400',
  emerald:'bg-emerald-500/10 text-emerald-400',
  violet:'bg-violet-500/10 text-violet-400',
  orange:'bg-orange-500/10 text-orange-400',
  lime:'bg-lime-500/10 text-lime-400',
  cyan:'bg-cyan-500/10 text-cyan-400',
  zinc:'bg-zinc-800 text-zinc-400',
}[tone]);

function CompactMetric({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div className={`rounded-2xl border px-3.5 py-3 ${alert?'border-amber-500/25 bg-amber-500/[.055]':'border-zinc-800 bg-zinc-900/45'}`}><p className={`text-[9px] font-bold ${alert?'text-amber-400':'text-zinc-600'}`}>{label}</p><p className="mt-1 truncate text-base font-black text-zinc-100">{value}</p></div>}
const prioritySort=(a:StockProduct,b:StockProduct)=>{const rank={zero:0,baixo:1,ok:2};return rank[stockLevel(a)]-rank[stockLevel(b)]||naturalStockNameCompare(a.name,b.name)};
const shortUnit=(p:StockProduct)=>SUPPLY_UNIT_LABELS[p.unit].toLocaleLowerCase('pt-BR');
function ProductRow({product,open,move}:{product:StockProduct;open:()=>void;move:()=>void}){const level=stockLevel(product);const target=Math.max(product.minimum_quantity,product.ideal_quantity||0);const rawBuy=Math.max(0,target-product.current_quantity);const plan=commercialPurchasePlan(product,rawBuy,0);const buy=plan.baseQuantity;const balance=physicalStockDisplay(product);const configured=target>0;const tone=level==='zero'?'bg-red-500/[.025]':level==='baixo'?'bg-amber-500/[.02]':'';return <article onClick={open} className={`flex cursor-pointer items-center gap-3 border-b border-zinc-800/60 p-3.5 last:border-0 ${tone}`}><div className={`h-11 w-1 rounded-full ${level==='zero'?'bg-red-500':level==='baixo'?'bg-amber-500':'bg-emerald-500'}`}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-zinc-200">{product.name}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${level==='zero'?'bg-red-500/10 text-red-400':level==='baixo'?'bg-amber-500/10 text-amber-400':'bg-emerald-500/10 text-emerald-400'}`}>{level==='zero'?'Zerado':level==='baixo'?'Baixo':'OK'}</span></div><p className={`mt-1 text-sm font-black ${level==='zero'?'text-red-300':level==='baixo'?'text-amber-300':'text-zinc-100'}`}>{balance.primary} <span className="text-[9px] font-bold text-zinc-600">em estoque</span></p>{balance.secondary&&<p className="text-[8px] text-zinc-600">equivale a {balance.secondary}</p>}<p className="mt-0.5 text-[9px] text-zinc-600">{configured?<>Mínimo {formatStockQuantity(product.minimum_quantity,product.unit)} · Meta {formatStockQuantity(target,product.unit)}</>:'Sem reposição obrigatória configurada'}</p>{configured&&buy>0&&<p className={`mt-1 text-[9px] font-black ${level==='zero'?'text-red-400':'text-amber-400'}`}>Comprar {humanPurchasePlan({purchaseQuantity:plan.purchaseQuantity,baseQuantity:plan.baseQuantity,baseUnit:product.unit,presentation:plan.presentation})}</p>}{Boolean(product.average_cost)&&<p className="mt-1 text-[9px] text-zinc-600">Custo médio {product.average_cost!.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/{shortUnit(product)} · <b className="text-emerald-400">{stockProductValue(product).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b> no estoque</p>}</div><button onClick={e=>{e.stopPropagation();move()}} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${level==='zero'?'bg-red-500/10 text-red-400':level==='baixo'?'bg-amber-500/10 text-amber-400':'bg-emerald-500/10 text-emerald-400'}`} aria-label={`Movimentar ${product.name}`}><ClipboardCheck size={17}/></button></article>}
function Metric({icon:Icon,label,value,alert}:{icon:typeof Boxes;label:string;value:string;alert?:boolean}){return <div className={`min-w-0 rounded-[22px] border p-4 ${alert?'border-amber-500/25 bg-amber-500/[.05]':'border-zinc-800 bg-zinc-900/45'}`}><Icon size={16} className={alert?'text-amber-400':'text-emerald-400'}/><p className="mt-3 truncate font-heading text-xl font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] font-bold text-zinc-600">{label}</p></div>}
function Shortcut({icon:Icon,label,color,onClick}:{icon:typeof Boxes;label:string;color:string;onClick:()=>void}){return <button onClick={onClick} className="flex min-h-14 min-w-0 items-center gap-3 rounded-[18px] border border-zinc-800/80 bg-zinc-900/45 px-3.5 py-3 text-left transition active:scale-[.98] active:bg-zinc-900"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950/60"><Icon size={17} className={color}/></span><p className="min-w-0 truncate text-[10px] font-black text-zinc-300">{label}</p></button>}
