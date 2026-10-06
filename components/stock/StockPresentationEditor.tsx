'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LockKeyhole, PackagePlus, Plus, Trash2 } from 'lucide-react';
import type { StockProductPresentation, StockSupplyUnit } from '@/types';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { parseStockQuantityInput } from '@/lib/stock-quantity';
import { humanPresentation } from '@/lib/stock-commercial-display-v2';

const field='h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-emerald-500';
const MASS:StockSupplyUnit[]=['g','kg'];
const VOLUME:StockSupplyUnit[]=['ml','l'];
const PURCHASE:StockSupplyUnit[]=['un','pct','cx','fardo','kg','g','l','ml'];

const compatible=(base:StockSupplyUnit):StockSupplyUnit[]=>MASS.includes(base)?MASS:VOLUME.includes(base)?VOLUME:[base];
const toBase=(value:number,from:StockSupplyUnit,to:StockSupplyUnit)=>{
 if(from===to)return value;
 if(from==='g'&&to==='kg')return value/1000;
 if(from==='kg'&&to==='g')return value*1000;
 if(from==='ml'&&to==='l')return value/1000;
 if(from==='l'&&to==='ml')return value*1000;
 return value;
};
const bestInputUnit=(base:StockSupplyUnit,v:number):StockSupplyUnit=>{
 if(base==='kg'&&v>0&&v<1)return'g';
 if(base==='l'&&v>0&&v<1)return'ml';
 return base;
};
const singular=(u:StockSupplyUnit)=>({un:'unidade',kg:'kg',g:'g',l:'L',ml:'ml',cx:'caixa',pct:'pacote',fardo:'fardo'} as const)[u];
const PLURAL_LABELS:Partial<Record<StockSupplyUnit,string>>={un:'unidades',cx:'caixas',pct:'pacotes',fardo:'fardos'};
const plural=(u:StockSupplyUnit,v:number)=>v===1?singular(u):PLURAL_LABELS[u]||singular(u);
const purchaseName=(u:StockSupplyUnit)=>({un:'Unidade',kg:'Quilo',g:'Grama',l:'Litro',ml:'Mililitro',cx:'Caixa',pct:'Pacote',fardo:'Fardo'} as const)[u];
const number=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:4});
const suggestedLabel=(purchase:StockSupplyUnit,q:number,base:StockSupplyUnit)=>{
 q=Math.max(0,Number(q)||0);
 if(!q)return purchaseName(purchase);
 if(purchase===base&&Math.abs(q-1)<1e-9)return purchaseName(purchase);
 if(purchase==='cx')return `Caixa com ${number(q)} ${plural(base,q)}`;
 if(purchase==='pct')return `Pacote com ${number(q)} ${plural(base,q)}`;
 if(purchase==='fardo')return `Fardo com ${number(q)} ${plural(base,q)}`;
 if(purchase==='un'&&base==='un')return q===1?'Unidade':`Unidade com ${number(q)} unidades`;
 return `${purchaseName(purchase)} de ${number(q)} ${plural(base,q)}`;
};

function PremiumUnitPicker({value,onChange}:{value:StockSupplyUnit;onChange:(unit:StockSupplyUnit)=>void}){
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const close=(event:PointerEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false)};
  document.addEventListener('pointerdown',close);
  return()=>document.removeEventListener('pointerdown',close);
 },[open]);
 return <div ref={ref} className="relative mt-1">
  <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className={`${field} flex items-center justify-between gap-2 text-left`}>
   <span className="font-bold">{SUPPLY_UNIT_LABELS[value]}</span><ChevronDown size={14} className={`text-zinc-500 transition ${open?'rotate-180':''}`}/>
  </button>
  {open&&<div role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-1.5 shadow-2xl shadow-black/50">
   {PURCHASE.map(unit=><button key={unit} type="button" role="option" aria-selected={unit===value} onClick={()=>{onChange(unit);setOpen(false)}} className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-left text-[11px] font-bold ${unit===value?'bg-emerald-500/12 text-emerald-300':'text-zinc-300 active:bg-zinc-900'}`}><span>{SUPPLY_UNIT_LABELS[unit]}</span>{unit===value&&<Check size={14}/>}</button>)}
  </div>}
 </div>;
}

export function StockPresentationEditor({baseUnit,value,onChange}:{baseUnit:StockSupplyUnit;value:StockProductPresentation[];onChange:(v:StockProductPresentation[])=>void}){
 const add=()=>onChange([...value,{id:`presentation-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:'',purchase_unit:baseUnit==='un'?'pct':baseUnit,conversion_quantity:1,active:true}]);
 const patch=(id:string,data:Partial<StockProductPresentation>)=>onChange(value.map(x=>x.id===id?{...x,...data}:x));
 return <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
  <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-zinc-100"><PackagePlus size={16} className="text-emerald-400"/>Como você compra este produto?</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Escolha a embalagem do fornecedor e informe quanto ela contém. O conteúdo é sempre convertido para a unidade de controle.</p></div><button type="button" onClick={add} className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-emerald-500/10 px-3 text-[10px] font-black text-emerald-400"><Plus size={13}/>Adicionar</button></div>
  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/[.035] px-3 py-2.5"><LockKeyhole size={13} className="text-emerald-400"/><p className="text-[9px] leading-relaxed text-zinc-500">Unidade física controlada: <b className="text-zinc-200">{SUPPLY_UNIT_LABELS[baseUnit]}</b>. Ela fica travada aqui para não misturar embalagem de compra com unidade consumida.</p></div>
  {!value.length&&<p className="mt-3 rounded-xl border border-dashed border-zinc-800 p-3 text-[10px] text-zinc-600">Nenhuma forma de compra cadastrada. Ex.: Pacote com 100 unidades, Caixa com 156 unidades ou Fardo com 6 unidades.</p>}
  <div className="mt-3 space-y-3">{value.map((item,index)=>{
   const inputUnit=bestInputUnit(baseUnit,item.conversion_quantity);
   const shown=toBase(item.conversion_quantity,baseUnit,inputUnit);
   const valid=item.label.trim()&&Number.isFinite(Number(item.conversion_quantity))&&Number(item.conversion_quantity)>0;
   const suggestion=suggestedLabel(item.purchase_unit,item.conversion_quantity,baseUnit);
   const updateConversion=(raw:string,unit:StockSupplyUnit)=>{const n=Math.max(0,parseStockQuantityInput(raw));patch(item.id,{conversion_quantity:Math.max(.0001,toBase(n,unit,baseUnit))});};
   return <div key={item.id} className={`rounded-2xl border p-3 ${item.active?'border-zinc-800 bg-zinc-950/45':'border-zinc-800/70 bg-zinc-950/25 opacity-75'}`}>
    <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">Forma de compra {index+1}</p><p className={`mt-0.5 text-[10px] font-black ${item.active?'text-emerald-400':'text-zinc-600'}`}>{item.active?'Ativa':'Pausada'}</p></div><button type="button" onClick={()=>patch(item.id,{active:!item.active})} className={`rounded-xl border px-3 py-2 text-[9px] font-black ${item.active?'border-emerald-500/20 bg-emerald-500/[.07] text-emerald-400':'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>{item.active?'Pausar':'Ativar'}</button></div>
    <div className="grid grid-cols-[1fr_44px] gap-2"><label className="text-[9px] font-bold text-zinc-500">Nome da apresentação<input value={item.label} onChange={e=>patch(item.id,{label:e.target.value})} placeholder={suggestion} className={`${field} mt-1`}/></label><button type="button" onClick={()=>onChange(value.filter(x=>x.id!==item.id))} className="mt-[17px] grid h-11 w-11 place-items-center rounded-xl bg-red-500/10 text-red-400" aria-label={`Remover ${item.label||'apresentação'}`}><Trash2 size={15}/></button></div>
    {!item.label.trim()&&<button type="button" onClick={()=>patch(item.id,{label:suggestion})} className="mt-2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-left text-[9px] font-bold text-zinc-400">Usar sugestão: <b className="text-emerald-400">{suggestion}</b></button>}
    <div className="mt-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
     <label className="text-[9px] font-bold text-zinc-500">Fornecedor vende por<PremiumUnitPicker value={item.purchase_unit} onChange={purchase_unit=>patch(item.id,{purchase_unit})}/></label>
     <div><p className="text-[9px] font-bold text-zinc-500">Cada {singular(item.purchase_unit)} contém</p><div className="mt-1 grid grid-cols-[1fr_92px] gap-1"><input key={`${item.id}-${inputUnit}`} inputMode="decimal" defaultValue={String(shown).replace('.',',')} onBlur={e=>updateConversion(e.target.value,inputUnit)} className={field}/><div className={`${field} flex items-center justify-between bg-zinc-900/80 text-zinc-400`} aria-label="Unidade de conteúdo bloqueada"><span>{plural(inputUnit,shown)}</span><LockKeyhole size={12}/></div></div>{compatible(baseUnit).length>1&&<p className="mt-1 text-[8px] text-zinc-600">{baseUnit==='kg'?'Aceita gramas e converte para kg.':'Aceita ml e converte para litros.'}</p>}</div>
    </div>
    {!valid?<p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[.06] px-3 py-2 text-[9px] font-bold leading-relaxed text-red-300">Forma de compra incompleta. Informe um nome e quanto existe dentro de cada embalagem.</p>:<div className="mt-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[.045] px-3 py-2.5"><p className="text-[9px] font-black uppercase tracking-wide text-emerald-400">Como o app vai entender</p><p className="mt-1 text-[11px] font-bold text-zinc-200">1 {singular(item.purchase_unit)} = {number(item.conversion_quantity)} {plural(baseUnit,item.conversion_quantity)}</p><p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Aparece como <b className="text-zinc-300">{humanPresentation(item,baseUnit)}</b>. Ao movimentar 1 {singular(item.purchase_unit)}, o estoque muda {number(item.conversion_quantity)} {plural(baseUnit,item.conversion_quantity)}.</p></div>}
   </div>
  })}</div>
 </section>;
}
