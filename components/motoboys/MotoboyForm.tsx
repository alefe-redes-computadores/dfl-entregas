// components/motoboys/MotoboyForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Bike, Calculator, Check, Package, UserRound } from 'lucide-react';
import type { Motoboy, MotoboyPaymentRule, MotoboyType, PaymentRuleType } from '@/types';

export interface MotoboyFormValue { name:string; active:boolean; type:MotoboyType; avatar:string; payment_rule?:MotoboyPaymentRule; }
interface Props { initial?:Motoboy; busy?:boolean; submitLabel:string; onSubmit:(value:MotoboyFormValue)=>Promise<void>; }
const moneyInput=(value:string)=>{const digits=value.replace(/\D/g,'');return digits?(Number(digits)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';};
const moneyNumber=(value:string)=>Number(value.replace(/\./g,'').replace(',','.'))||0;

export function MotoboyForm({initial,busy,submitLabel,onSubmit}:Props){
  const [name,setName]=useState(initial?.name||'');const [type,setType]=useState<MotoboyType>(initial?.type||'fixo');const [active,setActive]=useState(initial?.active??true);const [avatar,setAvatar]=useState(initial?.avatar||'bike-sky');
  const [ruleType,setRuleType]=useState<PaymentRuleType|''>(initial?.payment_rule?.type||'');const [fixed,setFixed]=useState(initial?.payment_rule?.fixed_amount?initial.payment_rule.fixed_amount.toLocaleString('pt-BR',{minimumFractionDigits:2}):'');const [rate,setRate]=useState(initial?.payment_rule?.delivery_fee?initial.payment_rule.delivery_fee.toLocaleString('pt-BR',{minimumFractionDigits:2}):'');const [threshold,setThreshold]=useState(initial?.payment_rule?.threshold?.toString()||'');const [extra,setExtra]=useState(initial?.payment_rule?.extra_fee?initial.payment_rule.extra_fee.toLocaleString('pt-BR',{minimumFractionDigits:2}):'');
  useEffect(()=>{if(!initial)return;setName(initial.name);setType(initial.type||'fixo');setActive(initial.active);setAvatar(initial.avatar||'bike-sky');setRuleType(initial.payment_rule?.type||'');setFixed(initial.payment_rule?.fixed_amount?initial.payment_rule.fixed_amount.toLocaleString('pt-BR',{minimumFractionDigits:2}):'');setRate(initial.payment_rule?.delivery_fee?initial.payment_rule.delivery_fee.toLocaleString('pt-BR',{minimumFractionDigits:2}):'');setThreshold(initial.payment_rule?.threshold?.toString()||'');setExtra(initial.payment_rule?.extra_fee?initial.payment_rule.extra_fee.toLocaleString('pt-BR',{minimumFractionDigits:2}):'');},[initial]);
  const buildRule = (): MotoboyPaymentRule | undefined => {
    if (!ruleType) return undefined;

    if (ruleType === 'fixed') {
      return {
        type: 'fixed',
        fixed_amount: moneyNumber(fixed),
      };
    }

    if (ruleType === 'per_delivery') {
      return {
        type: 'per_delivery',
        delivery_fee: moneyNumber(rate),
      };
    }

    return {
      type: 'fixed_plus_variable',
      fixed_amount: moneyNumber(fixed),
      threshold: Number(threshold) || 0,
      extra_fee: moneyNumber(extra),
    };
  };
  return <form onSubmit={async event=>{event.preventDefault();await onSubmit({name:name.trim(),active,type,avatar,payment_rule:buildRule()});}} className="flex flex-col gap-5 pb-10">
    <label className="flex flex-col gap-2"><span className="flex items-center gap-2 text-xs font-bold text-zinc-400"><UserRound size={14}/>Nome do entregador</span><input value={name} onChange={event=>setName(event.target.value)} placeholder="Ex: Bruno" required className="field"/></label>
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1"><button type="button" onClick={()=>setType('fixo')} className={`h-12 rounded-xl text-sm font-bold ${type==='fixo'?'bg-sky-500 text-zinc-950':'text-zinc-500'}`}>Fixo</button><button type="button" onClick={()=>setType('avulso')} className={`h-12 rounded-xl text-sm font-bold ${type==='avulso'?'bg-amber-500 text-zinc-950':'text-zinc-500'}`}>Avulso</button></div>
    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4"><div className="mb-3 flex items-center gap-2"><Calculator size={16} className="text-emerald-400"/><div><p className="text-xs font-black uppercase text-zinc-300">Regra de pagamento</p><p className="text-[10px] text-zinc-500">Nenhum valor é preenchido automaticamente</p></div></div><div className="flex flex-col gap-2">{([['','Configurar depois'],['fixed','Diária fixa'],['per_delivery','Por entrega'],['fixed_plus_variable','Fixo + entregas extras']] as const).map(([value,label])=><button key={value||'none'} type="button" onClick={()=>setRuleType(value)} className={`flex h-11 items-center justify-between rounded-xl px-3 text-left text-xs font-bold ${ruleType===value?'bg-zinc-800 text-zinc-100':'text-zinc-500'}`}>{label}{ruleType===value&&<Check size={15} className="text-emerald-400"/>}</button>)}</div>
      {ruleType==='fixed'&&<div className="mt-4"><MoneyField label="Valor da diária" value={fixed} setValue={setFixed}/></div>} {ruleType==='per_delivery'&&<div className="mt-4"><MoneyField label="Valor por entrega" value={rate} setValue={setRate}/></div>} {ruleType==='fixed_plus_variable'&&<div className="mt-4 grid grid-cols-2 gap-3"><MoneyField label="Base fixa" value={fixed} setValue={setFixed}/><label className="block text-[10px] font-bold text-zinc-500">Entregas inclusas<input type="number" min="0" value={threshold} onChange={event=>setThreshold(event.target.value)} className="field mt-1"/></label><div className="col-span-2 mt-1"><MoneyField label="Valor por entrega extra" value={extra} setValue={setExtra}/></div></div>}
    </section>
    {initial&&<div className={`flex items-center justify-between rounded-2xl border p-4 ${active?'border-emerald-500/20 bg-emerald-500/5':'border-red-500/20 bg-red-500/5'}`}><div><p className="text-sm font-bold text-zinc-200">Entregador ativo</p><p className="text-[10px] text-zinc-500">Inativos não aparecem em novas rotas</p></div><button type="button" onClick={()=>setActive(value=>!value)} className={`relative h-7 w-12 rounded-full ${active?'bg-emerald-500':'bg-zinc-700'}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${active?'translate-x-5':'translate-x-0'}`}/></button></div>}
    <button disabled={busy||!name.trim()} className="h-14 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-50">{busy?'Salvando...':submitLabel}</button>
    <style jsx>{`.field{height:3.25rem;width:100%;border-radius:1rem;border:1px solid rgb(39 39 42);background:rgb(24 24 27/.6);padding:0 1rem;color:rgb(244 244 245);font-size:.875rem;outline:none}.field:focus{border-color:rgb(14 165 233)}`}</style>
  </form>;
}
function MoneyField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <label className="block text-[10px] font-bold text-zinc-500">
      {label}
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
          R$
        </span>
        <input
          value={value}
          onChange={(event) => setValue(moneyInput(event.target.value))}
          inputMode="numeric"
          placeholder="0,00"
          className="h-[3.25rem] w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 pl-11 pr-4 text-sm font-bold text-zinc-100 outline-none transition focus:border-sky-500"
        />
      </div>
    </label>
  );
}
