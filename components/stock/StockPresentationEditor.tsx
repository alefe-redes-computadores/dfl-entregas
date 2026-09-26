'use client';

import { PackagePlus, Plus, Trash2 } from 'lucide-react';
import type { StockProductPresentation, StockSupplyUnit } from '@/types';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { parseStockQuantityInput } from '@/lib/stock-quantity';
import { humanPresentation } from '@/lib/stock-commercial-display-v2';

const field='h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-emerald-500';
const MASS:StockSupplyUnit[]=['g','kg'];
const VOLUME:StockSupplyUnit[]=['ml','l'];
const compatible=(base:StockSupplyUnit):StockSupplyUnit[]=>MASS.includes(base)?MASS:VOLUME.includes(base)?VOLUME:base==='un'?['un']: [base];
const toBase=(value:number,from:StockSupplyUnit,to:StockSupplyUnit)=>{
 if(from===to)return value;
 if(from==='g'&&to==='kg')return value/1000;
 if(from==='kg'&&to==='g')return value*1000;
 if(from==='ml'&&to==='l')return value/1000;
 if(from==='l'&&to==='ml')return value*1000;
 return value;
};
const bestInputUnit=(base:StockSupplyUnit,baseValue:number):StockSupplyUnit=>{
 if(base==='kg'&&baseValue>0&&baseValue<1)return'g';
 if(base==='l'&&baseValue>0&&baseValue<1)return'ml';
 return base;
};

export function StockPresentationEditor({baseUnit,value,onChange}:{baseUnit:StockSupplyUnit;value:StockProductPresentation[];onChange:(v:StockProductPresentation[])=>void}){
 const add=()=>onChange([...value,{id:`presentation-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:'',purchase_unit:baseUnit==='un'?'pct':baseUnit,conversion_quantity:1,active:true}]);
 const patch=(id:string,data:Partial<StockProductPresentation>)=>onChange(value.map(x=>x.id===id?{...x,...data}:x));
 return <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
  <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-zinc-100"><PackagePlus size={16} className="text-emerald-400"/>Como você compra este produto?</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Cadastre a embalagem como ela existe no fornecedor. O app converte para a unidade histórica sem reescrever movimentações antigas.</p></div><button type="button" onClick={add} className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-emerald-500/10 px-3 text-[10px] font-black text-emerald-400"><Plus size={13}/>Adicionar</button></div>
  {!value.length&&<p className="mt-3 rounded-xl border border-dashed border-zinc-800 p-3 text-[10px] text-zinc-600">Sem forma de compra cadastrada. A compra seguirá diretamente a unidade de controle.</p>}
  <div className="mt-3 space-y-3">{value.map(item=>{const inputUnit=bestInputUnit(baseUnit,item.conversion_quantity);const shown=toBase(item.conversion_quantity,baseUnit,inputUnit);return <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3">
   <div className="flex gap-2"><input value={item.label} onChange={e=>patch(item.id,{label:e.target.value})} placeholder={baseUnit==='un'?'Ex.: Pacote com 12':'Ex.: Pacote de 300 g'} className={field}/><button type="button" onClick={()=>onChange(value.filter(x=>x.id!==item.id))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400"><Trash2 size={15}/></button></div>
   <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[9px] font-bold text-zinc-500">Fornecedor vende por<select value={item.purchase_unit} onChange={e=>patch(item.id,{purchase_unit:e.target.value as StockSupplyUnit})} className={`${field} mt-1`}>{Object.entries(SUPPLY_UNIT_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <div><p className="text-[9px] font-bold text-zinc-500">Conteúdo de 1 embalagem</p><div className="mt-1 grid grid-cols-[1fr_72px] gap-1"><input key={`${item.id}-${inputUnit}`} inputMode="decimal" defaultValue={String(shown).replace('.',',')} onBlur={e=>{const n=Math.max(0,parseStockQuantityInput(e.target.value));patch(item.id,{conversion_quantity:Math.max(.0001,toBase(n,inputUnit,baseUnit))})}} className={field}/><select defaultValue={inputUnit} onChange={e=>{const next=e.target.value as StockSupplyUnit;const current=Math.max(0,parseStockQuantityInput((e.currentTarget.previousElementSibling as HTMLInputElement)?.value||'0'));patch(item.id,{conversion_quantity:Math.max(.0001,toBase(current,next,baseUnit))})}} className={field}>{compatible(baseUnit).map(u=><option key={u} value={u}>{u==='l'?'L':u}</option>)}</select></div></div></div>
   <p className="mt-2 text-[9px] text-zinc-500">Será exibido como <b className="text-zinc-300">{humanPresentation(item,baseUnit)}</b> · equivalente interno: {item.conversion_quantity.toLocaleString('pt-BR',{maximumFractionDigits:4})} {baseUnit}</p>
   <label className="mt-3 flex items-center gap-2 text-[9px] font-bold text-zinc-500"><input type="checkbox" checked={item.active} onChange={e=>patch(item.id,{active:e.target.checked})} className="accent-emerald-500"/>Ativa para novas compras</label>
  </div>})}</div>
 </section>;
}
