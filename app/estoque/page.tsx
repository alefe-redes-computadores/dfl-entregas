// app/estoque/page.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, BadgeDollarSign, BarChart3, Boxes, ChevronDown, ChevronLeft, ClipboardCheck, History, ListChecks, PackagePlus, Search, Store, Wallet, WandSparkles, SlidersHorizontal, X, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StockCatalogHealth } from '@/components/stock/StockCatalogHealth';
import { stockLevel, stockProductValue, stockValue } from '@/lib/stock';
import { buildStockRecommendations, stockIntelligenceSummary, type StockRecommendation } from '@/lib/stock-intelligence';
import { stockOperationLabel, stockOperationPriority, stockOperationTiming } from '@/lib/stock-operation';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { stockCategoryOrder, stockProductCategory, stockCategoryVisualClasses } from '@/lib/stock-categories';
import { StockCategoryIcon } from '@/components/stock/StockCategoryPicker';
import { StockCriticalBanner } from '@/components/stock/StockCriticalBanner';
import { BeverageStockReview } from '@/components/stock/BeverageStockReview';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { dualStockView } from '@/lib/stock-dual-unit';
import { buildReplenishmentRadar } from '@/lib/stock-replenishment-radar';
import { StockBarcodeFinder } from '@/components/stock/StockBarcodeFinder';
import { commercialPurchasePlan, committedStockQuantityMap } from '@/lib/stock-shopping';
import { formatCommercialPlan } from '@/lib/stock-commercial';
import { humanPurchasePlan, naturalStockNameCompare, physicalStockDisplay } from '@/lib/stock-commercial-display-v2';
import { buildDailyStockSignal } from '@/lib/stock-daily-plan';
import { guardedStockRecommendation } from '@/lib/stock-recommendation-guard';
import { commercialCoverage, commercialProductStatus } from '@/lib/stock-commercial-health';
import { parseStockPanelPreferences } from '@/lib/stock-panel-preferences';
import { readStockUiStorage, writeStockUiStorage, removeStockUiStorage } from '@/lib/stock-local-ui-storage';
import type { StockProduct } from '@/types';
import { rankStockProducts } from '@/lib/stock-search';

export default function StockPage() {
  const router=useRouter(); const products=useAppStore(s=>s.stockProducts); const movements=useAppStore(s=>s.stockMovements);const supplies=useAppStore(s=>s.stockSupplies);const committedMap=useMemo(()=>committedStockQuantityMap(supplies),[supplies]);
  const replenishmentRadar=useMemo(()=>buildReplenishmentRadar(products,committedMap),[products,committedMap]); const openPurchasesCount=useMemo(()=>supplies.filter(s=>s.status==='solicitado').length,[supplies]);
  const [query,setQuery]=useState(()=>readStockUiStorage('session','dfl-stock-query')||''); const [filterOpen,setFilterOpen]=useState(false); const [brainOpen,setBrainOpen]=useState(false); const [reviewOpen,setReviewOpen]=useState(false); const [moreOpen,setMoreOpen]=useState(false); const [commercialOnly,setCommercialOnly]=useState(false);
  const [planningTab,setPlanningTab]=useState<'dia'|'montar'>(()=>typeof window==='undefined'?'dia':parseStockPanelPreferences({planningTab: readStockUiStorage('local','dfl-stock-planning-tab')}).planningTab);
  const [filter,setFilter]=useState<'todos'|'baixo'|'zero'>(()=>typeof window==='undefined'?'todos':parseStockPanelPreferences({filter:readStockUiStorage('local','dfl-stock-filter')}).filter);
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>(()=>typeof window==='undefined'?{}:parseStockPanelPreferences({collapsed:readStockUiStorage('local','dfl-stock-collapsed')}).collapsed);
  const [categoryLimits,setCategoryLimits]=useState<Record<string,number>>({});
  const restoredScroll=useRef(false);
  const scrollFrame=useRef<number|null>(null);
  useEffect(()=>{writeStockUiStorage('local','dfl-stock-filter',filter)},[filter]);
  useEffect(()=>{writeStockUiStorage('session','dfl-stock-query',query)},[query]);
  useEffect(()=>{writeStockUiStorage('local','dfl-stock-collapsed',JSON.stringify(collapsed))},[collapsed]);
  useEffect(()=>{writeStockUiStorage('local','dfl-stock-planning-tab',planningTab)},[planningTab]);
  useEffect(()=>{
    if(restoredScroll.current||!products.length)return;
    restoredScroll.current=true;
    const rawY=Number(readStockUiStorage('session','dfl-stock-scroll')||0);
    const y=Number.isFinite(rawY)?Math.max(0,Math.min(rawY,5_000_000)):0;
    const anchor=readStockUiStorage('session','dfl-stock-anchor');
    if(y<=0&&!anchor)return;
    let tries=0;
    const restore=()=>{
      const escaped=anchor&&typeof CSS!=='undefined'&&CSS.escape?CSS.escape(anchor):anchor;
      const element=escaped?document.querySelector(`[data-stock-product="${escaped}"]`):null;
      if(element instanceof HTMLElement){
        element.scrollIntoView({block:'center',behavior:'auto'});
        element.classList.add('ring-1','ring-emerald-400/50');
        window.setTimeout(()=>element.classList.remove('ring-1','ring-emerald-400/50'),1200);
        removeStockUiStorage('session','dfl-stock-anchor');
        return;
      }
      if(y>0)window.scrollTo({top:y,behavior:'auto'});
      tries+=1;
      if(tries<10)setTimeout(restore,50*tries);
    };
    requestAnimationFrame(restore);
  },[products.length]);
  useEffect(()=>{
    // Guardar o scroll em cada evento causa I/O síncrono em excesso no Android.
    const save=()=>{
      if(scrollFrame.current!==null)return;
      scrollFrame.current=window.requestAnimationFrame(()=>{
        scrollFrame.current=null;
        writeStockUiStorage('session','dfl-stock-scroll',String(window.scrollY));
      });
    };
    window.addEventListener('scroll',save,{passive:true});
    return()=>{
      window.removeEventListener('scroll',save);
      if(scrollFrame.current!==null)window.cancelAnimationFrame(scrollFrame.current);
      writeStockUiStorage('session','dfl-stock-scroll',String(window.scrollY));
    };
  },[]);
  const rememberAndPush=(href:string,productId?:string)=>{writeStockUiStorage('session','dfl-stock-scroll',String(window.scrollY));if(productId)writeStockUiStorage('session','dfl-stock-anchor',productId);router.push(href)};
  const leaveStock=()=>{removeStockUiStorage('session','dfl-stock-scroll');removeStockUiStorage('session','dfl-stock-anchor');removeStockUiStorage('session','dfl-stock-query');router.replace('/loja')};
  const active=useMemo(()=>products.filter(p=>p.active),[products]);
  const commercialHealth=useMemo(()=>commercialCoverage(active),[active]);
  const estimatedStockValue=useMemo(()=>stockValue(active),[active]);
  const stockCounts=useMemo(()=>active.reduce((counts,p)=>{
    const level=stockLevel(p);
    if(level==='zero')counts.zero+=1;
    if(level==='baixo')counts.baixo+=1;
    return counts;
  },{zero:0,baixo:0}),[active]);
  const movementsByProduct=useMemo(()=>{
    const index=new Map<string,typeof movements>();
    for(const movement of movements){
      const group=index.get(movement.product_id);
      if(group)group.push(movement);else index.set(movement.product_id,[movement]);
    }
    return index;
  },[movements]);
  const recommendations=useMemo(()=>buildStockRecommendations(active,movements),[active,movements]);
  const stockBrain=useMemo(()=>stockIntelligenceSummary(active,movements,recommendations),[active,movements,recommendations]);
  const recommendationMap=useMemo(()=>new Map(recommendations.map(item=>[item.productId,item])),[recommendations]);
  const suggested=useMemo(()=>active.filter(p=>{const r=recommendationMap.get(p.id);if(!r)return false;return guardedStockRecommendation(p,r).quantity>0}).sort(prioritySort),[active,recommendationMap]);
  const commercialMissing=useMemo(()=>active.filter(p=>{const status=commercialProductStatus(p);return status==='fractional_without_presentation'||status==='invalid_presentation'}),[active]);
  const daily=useMemo(()=>{
    const now=new Date();
    return active.map(product=>({p:product,signal:buildDailyStockSignal(product,movementsByProduct.get(product.id)||[],now,recommendationMap.get(product.id))}))
      .filter(x=>x.signal.suggested>0&&(Math.max(x.p.minimum_quantity,x.p.ideal_quantity||0)>0||x.signal.usesWeekday))
      .sort((a,b)=>b.signal.suggested-a.signal.suggested);
  },[active,movementsByProduct,recommendationMap]);
  const commercialAttentionIds=useMemo(()=>new Set(commercialMissing.map(p=>p.id)),[commercialMissing]);
  const visible=useMemo(()=>rankStockProducts(active.filter(p=>(filter==='todos'||stockLevel(p)===filter)&&(!commercialOnly||commercialAttentionIds.has(p.id))),query).sort(query.trim()?()=>0:prioritySort),[active,filter,query,commercialOnly,commercialAttentionIds]);
  const groups=useMemo(()=>{
    const rank=new Map(visible.map((p,i)=>[p.id,i]));
    return Object.entries(visible.reduce<Record<string,StockProduct[]>>((all,p)=>{const key=stockProductCategory(p.name,p.category);(all[key]||=[]).push(p);return all},{}))
      .map(([category,items])=>[category,[...items].sort(query.trim()?((a,b)=>(rank.get(a.id)||0)-(rank.get(b.id)||0)):prioritySort)] as [string,StockProduct[]])
      .sort(([a],[b])=>stockCategoryOrder(a)-stockCategoryOrder(b)||a.localeCompare(b,'pt-BR'));
  },[visible,query]);
  const reviewOrder=useMemo(()=>groups.flatMap(([,items])=>items),[groups]);
  const reviewIds=useMemo(()=>JSON.stringify(reviewOrder.map(item=>item.id)),[reviewOrder]);
  const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return <div className="dfl-page">
    <header className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={leaveStock} className="grid h-12 w-12 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400"><ChevronLeft size={21}/></button><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-400">Controle físico</p><h1 className="font-heading text-2xl font-black text-zinc-100">Estoque</h1></div></div></header>
    <section className="sticky top-[calc(var(--dfl-safe-top)+8px)] z-30 rounded-[20px] border border-zinc-800 bg-zinc-950/95 p-2 shadow-xl backdrop-blur-xl"><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Pesquisar produtos e categorias do estoque" placeholder="Buscar produto ou categoria" className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-10 text-sm text-zinc-100 outline-none focus:border-emerald-500/60"/>{query&&<button aria-label="Limpar busca" onClick={()=>setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"><X size={16}/></button>}</div><button type="button" aria-label="Filtrar estoque" aria-expanded={filterOpen} aria-pressed={filter!=='todos'} onClick={()=>setFilterOpen(v=>!v)} className={`grid h-12 w-12 place-items-center rounded-xl border ${filter!=='todos'?'border-emerald-500/35 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}><SlidersHorizontal size={17}/></button></div>{query&&<p className="px-1 pt-2 text-[9px] font-bold text-zinc-500">{visible.length} resultado{visible.length===1?'':'s'} · painéis ocultos durante a busca</p>}</section>
    <div className={`flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-2 ${filterOpen?'':'opacity-95'}`} role="group" aria-label="Estado do estoque">{(['todos','baixo','zero'] as const).map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>{setFilter(key);setFilterOpen(false)}} className={`h-9 flex-1 rounded-xl text-[10px] font-black ${filter===key?'bg-emerald-500/10 text-emerald-400':'text-zinc-500'}`}>{key==='todos'?'Todos':key==='baixo'?`Baixo · ${stockCounts.baixo}`:`Zerado · ${stockCounts.zero}`}</button>)}</div>
    {!query&&<section className="overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-900/45" aria-label="Resumo do estoque">
      <div className="grid grid-cols-3 divide-x divide-zinc-800">
        <CompactMetric label="Ativos" value={String(active.length)} />
        <CompactMetric label="Zerados" value={String(stockCounts.zero)} alert={stockCounts.zero>0} />
        <CompactMetric label="Comprar" value={String(suggested.length)} alert={suggested.length>0} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-3.5 py-2 text-[9px] font-bold text-zinc-500">
        <span>Valor estimado <b className="text-zinc-300">{money(estimatedStockValue)}</b></span>
        <span>{openPurchasesCount} {openPurchasesCount===1?'compra aberta':'compras abertas'}</span>
      </div>
    </section>}
    {!query&&<section className="grid grid-cols-3 gap-2"><Shortcut icon={ClipboardCheck} label="Contagem" color="text-sky-400" onClick={()=>rememberAndPush('/estoque/contagem')}/><Shortcut icon={ListChecks} label="Comprar" color="text-amber-400" onClick={()=>rememberAndPush('/estoque/compras')}/><Shortcut icon={moreOpen?X:Boxes} label={moreOpen?'Fechar':'Mais'} color="text-emerald-400" onClick={()=>setMoreOpen(v=>!v)}/>{moreOpen&&<><Shortcut icon={BarChart3} label="Relatórios" color="text-emerald-400" onClick={()=>rememberAndPush('/estoque/relatorios')}/><Shortcut icon={Archive} label="Arquivados" color="text-zinc-400" onClick={()=>rememberAndPush('/estoque/arquivados')}/><Shortcut icon={Store} label="Fornecedores" color="text-orange-400" onClick={()=>rememberAndPush('/estoque/fornecedores')}/><Shortcut icon={BadgeDollarSign} label="Preços" color="text-lime-400" onClick={()=>rememberAndPush('/estoque/precos')}/><Shortcut icon={WandSparkles} label="Catálogo" color="text-violet-400" onClick={()=>rememberAndPush('/estoque/catalogo')}/></>}</section>}
    {!query&&<section className="overflow-hidden rounded-[20px] border border-sky-500/15 bg-sky-500/[.035]"><button type="button" onClick={()=>setReviewOpen(value=>!value)} className="flex w-full items-center gap-3 p-3.5 text-left"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-400"><ClipboardCheck size={17}/></span><div className="min-w-0 flex-1"><p className="text-xs font-black text-zinc-200">Revisões do estoque</p><p className="mt-0.5 text-[9px] text-zinc-500">{commercialHealth.attention} embalagens · alertas e conferências em um só lugar</p></div><ChevronDown size={16} className={`text-sky-400 transition ${reviewOpen?'rotate-180':''}`}/></button>{reviewOpen&&<div className="space-y-2 border-t border-sky-500/10 p-2.5"><StockCriticalBanner products={active} /><BeverageStockReview />{commercialHealth.attention>0&&<button type="button" onClick={()=>commercialMissing.length===1?rememberAndPush(`/estoque/editar?id=${commercialMissing[0].id}&from=estoque`,commercialMissing[0].id):(setCommercialOnly(true),setReviewOpen(false),setFilter('todos'),setQuery(''))} className="flex w-full items-center justify-between rounded-xl bg-zinc-950/40 p-3 text-left"><div><p className="text-[10px] font-black text-sky-300">Formas de compra</p><p className="mt-1 text-[9px] text-zinc-500">{commercialHealth.attention} produto{commercialHealth.attention===1?' precisa':'s precisam'} informar a embalagem real.</p></div><ChevronLeft size={15} className="rotate-180 text-sky-400"/></button>}<StockCatalogHealth products={active} onOpen={(productId)=>rememberAndPush(`/estoque/editar?id=${productId}&from=estoque`,productId)}/></div>}</section>}
    {/* R130_RADAR_COMPRAS: pendencias reais descontam compras abertas, sem alterar saldo. */}
    {!query&&(replenishmentRadar.needsAction>0||replenishmentRadar.coveredByOrders>0)&&
      <section aria-label="Radar de reposição" className="rounded-[22px] border border-sky-500/20 bg-sky-500/[.045] p-4">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-black text-sky-300">Radar de reposição</p><p className="mt-1 text-[10px] text-zinc-400">Considera metas cadastradas e quantidades de compras em aberto.</p></div>
          <button type="button" onClick={()=>rememberAndPush('/estoque/compras')} className="shrink-0 rounded-xl border border-sky-500/25 px-3 py-2 text-[10px] font-black text-sky-300">Ver compras</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-zinc-950/60 p-3"><p className="text-[10px] text-zinc-500">Ainda precisa comprar</p><p className="mt-1 text-xl font-black text-amber-300">{replenishmentRadar.needsAction}</p></div>
          <div className="rounded-xl bg-zinc-950/60 p-3"><p className="text-[10px] text-zinc-500">Cobertos por pedidos</p><p className="mt-1 text-xl font-black text-emerald-300">{replenishmentRadar.coveredByOrders}</p></div>
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">Compras solicitadas não aumentam o estoque até o recebimento. Sugestões sujeitas à conferência.</p>
      </section>}
    {!query&&suggested.length>0&&<section className="rounded-[22px] border border-amber-500/25 bg-amber-500/[.055] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-amber-400">Reposição inteligente</p>
          <p className="mt-1 text-[10px] text-zinc-500">{suggested.length} {suggested.length===1?'produto pede':'produtos pedem'} reposição · {stockBrain.historyBacked} com histórico suficiente</p>
        </div>

      </div>
      <button type="button" onClick={()=>setBrainOpen(v=>!v)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-zinc-950/45 px-3 py-2 text-[9px] font-black text-amber-300"><span>{brainOpen?'Ocultar recomendações':'Ver recomendações e motivos'}</span><ChevronDown size={14} className={brainOpen?'rotate-180':''}/></button>
      {brainOpen&&<div className="mt-2 grid grid-cols-2 gap-2">
        {suggested.slice(0,4).map(p=>{const rec=recommendationMap.get(p.id)!;return <button type="button" key={p.id} onClick={()=>rememberAndPush(`/estoque/detalhes?id=${p.id}&from=estoque`,p.id)} className="rounded-xl bg-zinc-950/50 px-3 py-2 text-left transition active:scale-[.98] active:bg-zinc-900">
          <p className="truncate text-[10px] font-bold text-zinc-300">{p.name}</p>
          <p className="mt-0.5 text-[9px] font-black text-amber-400">Comprar {(()=>{const guarded=guardedStockRecommendation(p,rec);const plan=commercialPurchasePlan(p,guarded.quantity,committedMap.get(p.id)||0);return humanPurchasePlan({purchaseQuantity:plan.purchaseQuantity,baseQuantity:plan.baseQuantity,baseUnit:p.unit,presentation:plan.presentation})})()}</p>
          <p className="mt-1 truncate text-[8px] text-zinc-600">{rec.minimumReached?'Mínimo atingido agora':rec.daysUntilMinimum!==null?`~${rec.daysUntilMinimum.toLocaleString('pt-BR',{maximumFractionDigits:1})} dias até o mínimo · confiança ${rec.confidence}`:'Regra configurada · histórico insuficiente'}</p>
        </button>})}
      </div>}
      {stockBrain.withoutSafetyStock>0&&<p className="mt-3 text-[9px] font-bold text-amber-300/80">{stockBrain.withoutSafetyStock} produto{stockBrain.withoutSafetyStock===1?' está':'s estão'} sem estoque de segurança configurado.</p>}
      {suggested.length>4&&<p className="mt-2 text-[9px] font-bold text-zinc-600">+ {suggested.length-4} outros produtos</p>}
    </section>}
    {!query&&(daily.length>0||suggested.length>0)&&<section className="rounded-[22px] border border-emerald-500/15 bg-emerald-500/[.035] p-4">
      <div className="flex items-center gap-2"><CalendarDays size={16} className="text-emerald-400"/><div><p className="text-xs font-black text-zinc-100">Planejamento de compra</p><p className="text-[9px] text-zinc-500">Veja a necessidade de hoje ou avance para montar a compra.</p></div></div>
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-zinc-950/55 p-1">
        <button type="button" onClick={()=>setPlanningTab('dia')} className={`h-9 rounded-lg text-[9px] font-black transition ${planningTab==='dia'?'bg-emerald-500/12 text-emerald-400':'text-zinc-600'}`}>Compra do dia</button>
        <button type="button" onClick={()=>setPlanningTab('montar')} className={`h-9 rounded-lg text-[9px] font-black transition ${planningTab==='montar'?'bg-amber-500/12 text-amber-400':'text-zinc-600'}`}>Montar compra</button>
      </div>
      {planningTab==='dia'?<>
        <p className="mt-3 text-[9px] leading-relaxed text-zinc-500">Sugestão contextual pelo consumo deste dia da semana; sem amostra, mantém sua meta.</p>
        {daily.length>0?<><div className="mt-3 grid grid-cols-2 gap-2">{daily.slice(0,4).map(({p,signal})=><button key={p.id} onClick={()=>rememberAndPush(`/estoque/detalhes?id=${p.id}&from=estoque`,p.id)} className="rounded-xl bg-zinc-950/45 p-3 text-left"><p className="truncate text-[10px] font-black text-zinc-300">{p.name}</p><p className="mt-1 text-[9px] font-black text-emerald-400">{humanPurchasePlan({purchaseQuantity:signal.commercialPlan.purchaseQuantity,baseQuantity:signal.commercialPlan.baseQuantity,baseUnit:p.unit,presentation:signal.commercialPlan.presentation})} sugerido</p><p className="mt-1 text-[8px] text-zinc-600">{signal.recommendationReason}</p></button>)}</div>{daily.length>4&&<p className="mt-2 text-[9px] font-bold text-zinc-600">+ {daily.length-4} outros produtos</p>}</>:<p className="mt-3 rounded-xl bg-zinc-950/35 p-3 text-[10px] text-zinc-600">Nenhuma necessidade para hoje.</p>}
      </>:<div className="mt-3 rounded-2xl border border-amber-500/15 bg-amber-500/[.04] p-3">
        <p className="text-[10px] font-black text-zinc-200">{suggested.length?`${suggested.length} ${suggested.length===1?'produto pronto':'produtos prontos'} para revisar`:'Estoque sem reposição pendente'}</p>
        <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">A tela de compra aplica apresentações, quantidades já comprometidas e permite revisar os itens antes de criar a compra.</p>
        <button type="button" onClick={()=>rememberAndPush('/estoque/compras')} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-[10px] font-black text-zinc-950"><ListChecks size={15}/>Abrir montagem da compra</button>
      </div>}
    </section>}
    <section className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3"><div className="min-w-0"><p className="text-[10px] font-black text-zinc-200">Encontrar produto</p><p className="text-[9px] text-zinc-600">EAN/UPC cadastrado · sem leituras extras</p></div><StockBarcodeFinder products={active} onSelect={product=>rememberAndPush(`/estoque/detalhes?id=${product.id}&from=estoque`,product.id)}/></section>
    <section className="space-y-3" aria-label="Produtos do estoque"><div role="status" aria-live="polite" className="flex items-center justify-between gap-2 px-1 text-[10px] text-zinc-500"><span>{commercialOnly?'Embalagens para revisar · ':''}{visible.length} {visible.length===1?'produto encontrado':'produtos encontrados'}</span>{(filter!=='todos'||commercialOnly)&&<button type="button" onClick={()=>{setFilter('todos');setCommercialOnly(false)}} className="min-h-9 rounded-lg border border-zinc-700 px-3 font-bold text-emerald-300">Limpar filtros</button>}</div>{groups.map(([category,items])=>{const attention=items.filter(p=>stockLevel(p)!=='ok').length;const isCollapsed=Boolean(collapsed[category]);return <section key={category} className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/35"><button onClick={()=>setCollapsed(v=>({...v,[category]:!v[category]}))} className="flex w-full items-center gap-3 p-4 text-left"><span className={`grid h-9 w-9 place-items-center rounded-xl border ${stockCategoryVisualClasses(category)}`}><StockCategoryIcon category={category} size={16}/></span><div className="min-w-0 flex-1"><h2 className="truncate font-heading text-sm font-black text-zinc-200">{category}</h2><p className="mt-0.5 text-[9px] text-zinc-600">{items.length} {items.length===1?'produto':'produtos'}{attention?` · ${attention} em atenção`:''}</p></div><ChevronDown size={17} className={`text-zinc-600 transition-transform ${isCollapsed?'-rotate-90':''}`}/></button>{!isCollapsed&&<div className="border-t border-zinc-800/70">{items.slice(0,categoryLimits[category]||24).map(product=><ProductRow key={product.id} product={product} recommendation={recommendationMap.get(product.id)} committed={committedMap.get(product.id)||0} open={()=>rememberAndPush(`/estoque/detalhes?id=${product.id}&from=estoque`,product.id)} move={()=>{writeStockUiStorage('session','dfl-stock-review-queue',reviewIds);rememberAndPush(`/estoque/movimentar?id=${product.id}&from=estoque`,product.id)}}/>)}{items.length>24&&<button type="button" onClick={()=>setCategoryLimits(prev=>({...prev,[category]:(prev[category]||24)>=items.length?24:Math.min(items.length,(prev[category]||24)+24)}))} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-zinc-800/70 bg-zinc-950/25 px-3 text-[11px] font-bold text-zinc-300 active:bg-zinc-800" aria-label={(categoryLimits[category]||24)>=items.length?`Recolher itens de ${category}`:`Ver mais produtos de ${category}`}><ChevronDown size={14} className={(categoryLimits[category]||24)>=items.length?'rotate-180':''}/>{(categoryLimits[category]||24)>=items.length?'Recolher produtos':`Ver mais ${Math.min(24,items.length-(categoryLimits[category]||24))} · ${Math.min(categoryLimits[category]||24,items.length)} de ${items.length}`}</button>}</div>}</section>})}{!groups.length&&<div className="dfl-empty" role="status"><PackagePlus size={34} className="mx-auto text-zinc-700"/><p className="mt-3 text-sm font-bold text-zinc-300">{query.trim()?'Nenhum produto corresponde à busca':commercialOnly?'Nenhuma embalagem pendente de revisão':filter==='zero'?'Nenhum produto zerado':filter==='baixo'?'Nenhum produto com estoque baixo':'Nenhum produto cadastrado'}</p>{(query.trim()||filter!=='todos'||commercialOnly)&&<button type="button" onClick={()=>{setQuery('');setFilter('todos');setCommercialOnly(false)}} className="mt-3 min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-black text-emerald-300">Limpar busca e filtros</button>}</div>}</section>
  </div>;
}
function CompactMetric({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div className={`min-w-0 px-3 py-3 ${alert?'bg-amber-500/[.045]':''}`}><p className={`text-[8px] font-bold uppercase tracking-wider ${alert?'text-amber-400':'text-zinc-600'}`}>{label}</p><p className="mt-1 truncate text-lg font-black tabular-nums text-zinc-100">{value}</p></div>}
const prioritySort=(a:StockProduct,b:StockProduct)=>{const rank={zero:0,baixo:1,ok:2};return rank[stockLevel(a)]-rank[stockLevel(b)]||naturalStockNameCompare(a.name,b.name)};
const shortUnit=(p:StockProduct)=>SUPPLY_UNIT_LABELS[p.unit].toLocaleLowerCase('pt-BR');
function ProductRow({product,recommendation,committed,open,move}:{product:StockProduct;recommendation?:StockRecommendation;committed:number;open:()=>void;move:()=>void}){const level=stockLevel(product);const guarded=guardedStockRecommendation(product,recommendation);const plan=commercialPurchasePlan(product,guarded.quantity,committed);const balance=dualStockView(product)||physicalStockDisplay(product);const configured=guarded.configuredTarget>0;const priority=stockOperationPriority(product,recommendation);const timing=stockOperationTiming(recommendation);const tone=level==='zero'?'bg-red-500/[.025]':level==='baixo'?'bg-amber-500/[.02]':'';return <article data-stock-product={product.id} role="group" tabIndex={0} aria-label={`Toque no card para movimentar ${product.name}; toque no nome para detalhes`} onClick={(event)=>{if((event.target as HTMLElement).closest('button,a,input'))return;move()}} onKeyDown={(event)=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();move()}}} className={`flex cursor-pointer scroll-mt-28 items-center gap-3 border-b border-zinc-800/60 p-3.5 outline-none transition-colors hover:bg-white/[.025] active:bg-white/[.045] focus-visible:bg-white/[.05] focus-visible:ring-2 focus-visible:ring-emerald-500/60 last:border-0 ${tone}`}><div className={`h-14 w-1 rounded-full ${level==='zero'?'bg-red-500':level==='baixo'?'bg-amber-500':'bg-emerald-500'}`}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><button type="button" onClick={event=>{event.stopPropagation();open()}} aria-label={`Abrir detalhes de ${product.name}`} className="truncate text-left text-sm font-black text-zinc-200 underline-offset-2 focus-visible:underline">{product.name}</button><span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${priority==='ruptura'?'bg-red-500/10 text-red-400':priority==='comprar_agora'?'bg-amber-500/10 text-amber-400':priority==='planejar'?'bg-sky-500/10 text-sky-300':'bg-emerald-500/10 text-emerald-400'}`}>{stockOperationLabel(priority)}</span></div><p className={`mt-1 text-sm font-black ${level==='zero'?'text-red-300':level==='baixo'?'text-amber-300':'text-zinc-100'}`}>{balance.primary} <span className="text-[9px] font-bold text-zinc-600">em estoque</span></p>{balance.secondary&&<p className="text-[8px] text-zinc-600">equivale a {balance.secondary}</p>}<p className="mt-0.5 text-[9px] text-zinc-600">{configured?<>Mínimo {formatStockQuantity(product.minimum_quantity,product.unit)} · Meta {formatStockQuantity(guarded.configuredTarget,product.unit)}{recommendation?.daysUntilMinimum!==null?` · mínimo em ${timing.minimum}`:''}</>:'Sem reposição obrigatória configurada'}</p>{plan.purchaseQuantity>0&&<p className={`mt-1 text-[9px] font-black ${level==='zero'?'text-red-400':'text-amber-400'}`}>Comprar {humanPurchasePlan({purchaseQuantity:plan.purchaseQuantity,baseQuantity:plan.baseQuantity,baseUnit:product.unit,presentation:plan.presentation})} <span className="font-bold text-zinc-600">· {guarded.mode==='history'?'histórico confiável':guarded.mode==='guarded'?'histórico parcial':'meta cadastrada'}</span></p>}{committed>0&&<p className="mt-1 text-[9px] font-bold text-emerald-400">{formatStockQuantity(committed,product.unit)} já está em compra aberta</p>}{Boolean(product.average_cost)&&<p className="mt-1 text-[9px] text-zinc-600">Custo médio {product.average_cost!.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/{shortUnit(product)} · <b className="text-emerald-400">{stockProductValue(product).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b> no estoque</p>}</div><button onClick={e=>{e.stopPropagation();move()}} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${level==='zero'?'bg-red-500/10 text-red-400':level==='baixo'?'bg-amber-500/10 text-amber-400':'bg-emerald-500/10 text-emerald-400'}`} aria-label={`Movimentar ${product.name}`}><ClipboardCheck size={17}/></button></article>}
function Metric({icon:Icon,label,value,alert}:{icon:typeof Boxes;label:string;value:string;alert?:boolean}){return <div className={`min-w-0 rounded-[22px] border p-4 ${alert?'border-amber-500/25 bg-amber-500/[.05]':'border-zinc-800 bg-zinc-900/45'}`}><Icon size={16} className={alert?'text-amber-400':'text-emerald-400'}/><p className="mt-3 truncate font-heading text-xl font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] font-bold text-zinc-600">{label}</p></div>}
function Shortcut({icon:Icon,label,color,onClick}:{icon:typeof Boxes;label:string;color:string;onClick:()=>void}){return <button type="button" onClick={onClick} className="flex min-h-14 min-w-0 items-center gap-3 rounded-[18px] border border-zinc-800/80 bg-zinc-900/45 px-3.5 py-3 text-left transition active:scale-[.98] active:bg-zinc-900"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950/60"><Icon size={17} className={color}/></span><p className="min-w-0 truncate text-[10px] font-black text-zinc-300">{label}</p></button>}
