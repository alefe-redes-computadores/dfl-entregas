'use client';

import { PackagePlus, Plus, Trash2 } from 'lucide-react';
import type { StockProductPresentation, StockSupplyUnit } from '@/types';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { normalizeStockQuantityInput, parseStockQuantityInput } from '@/lib/stock-quantity';
import { commercialUnitHint, isDiscretePurchaseUnit } from '@/lib/stock-commercial';

const field = 'h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-amber-500';

export function StockPresentationEditor({ baseUnit, value, onChange }: { baseUnit: StockSupplyUnit; value: StockProductPresentation[]; onChange: (value: StockProductPresentation[]) => void; }) {
  const add = () => onChange([...value, { id: `presentation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: '', purchase_unit: baseUnit === 'un' ? 'pct' : baseUnit, conversion_quantity: 1, active: true }]);
  const patch = (id: string, data: Partial<StockProductPresentation>) => onChange(value.map((item) => item.id === id ? { ...item, ...data } : item));

  return <section className="rounded-[24px] border border-amber-500/15 bg-amber-500/[.035] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-black text-zinc-100"><PackagePlus size={16} className="text-amber-400"/>Como este produto é comprado?</p>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">O saldo continua em <b className="text-zinc-300">{SUPPLY_UNIT_LABELS[baseUnit]}</b>. A embalagem só traduz a compra para uma quantidade que existe no fornecedor.</p>
      </div>
      <button type="button" onClick={add} className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-amber-500/10 px-3 text-[10px] font-black text-amber-400"><Plus size={13}/>Adicionar</button>
    </div>
    <p className="mt-3 rounded-xl bg-zinc-950/60 px-3 py-2 text-[9px] leading-relaxed text-zinc-500">{commercialUnitHint(baseUnit)}. Você pode cadastrar mais de uma apresentação e escolher na compra. <b className="text-zinc-300">Isso vale para compras futuras:</b> movimentações antigas não são convertidas.</p>
    {!value.length && <p className="mt-3 rounded-xl border border-dashed border-zinc-800 p-3 text-[10px] text-zinc-600">Sem embalagem: a inteligência usa a unidade-base. Para itens inteiros, nunca sugere fração de unidade.</p>}
    <div className="mt-3 space-y-3">{value.map((item) => <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center gap-2"><input value={item.label} onChange={(e)=>patch(item.id,{label:e.target.value})} placeholder={baseUnit==='un'?'Ex.: Pacote com 12':'Ex.: Pacote de 500 g'} className={field}/><button type="button" onClick={()=>onChange(value.filter((x)=>x.id!==item.id))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400"><Trash2 size={15}/></button></div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[9px] font-bold text-zinc-500">Fornecedor vende por<select value={item.purchase_unit} onChange={(e)=>patch(item.id,{purchase_unit:e.target.value as StockSupplyUnit})} className={`${field} mt-1`}>{Object.entries(SUPPLY_UNIT_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-[9px] font-bold text-zinc-500">1 embalagem adiciona<input inputMode="decimal" value={String(item.conversion_quantity).replace('.',',')} onChange={(e)=>patch(item.id,{conversion_quantity:Math.max(0,parseStockQuantityInput(e.target.value))})} onBlur={(e)=>{const n=parseStockQuantityInput(e.target.value); e.currentTarget.value=normalizeStockQuantityInput(String(n||1)); if(!(n>0))patch(item.id,{conversion_quantity:1});}} className={`${field} mt-1`}/></label>
      </div>
      <p className="mt-2 text-[9px] text-zinc-500">1 {SUPPLY_UNIT_LABELS[item.purchase_unit].toLocaleLowerCase('pt-BR')} = <b className="text-zinc-300">{item.conversion_quantity.toLocaleString('pt-BR',{maximumFractionDigits:3})} {SUPPLY_UNIT_LABELS[baseUnit].toLocaleLowerCase('pt-BR')}</b>{isDiscretePurchaseUnit(item.purchase_unit)?' · compra em quantidade inteira':''}</p>{value.some((other)=>other.id!==item.id&&other.active&&item.active&&other.purchase_unit===item.purchase_unit&&Math.abs(other.conversion_quantity-item.conversion_quantity)<0.000001)&&<p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[9px] font-bold text-amber-300">Apresentação duplicada: já existe outra ativa com a mesma unidade e conteúdo.</p>}<label className="mt-3 flex items-center gap-2 text-[9px] font-bold text-zinc-500"><input type="checkbox" checked={item.active} onChange={(e)=>patch(item.id,{active:e.target.checked})} className="accent-amber-500"/>Ativa para novas compras</label>
    </div>)}</div>
  </section>;
}
