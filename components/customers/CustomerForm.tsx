'use client';

import { useEffect, useState } from 'react';
import { MapPin, MessageSquare, Plus, ShoppingBag, Smartphone, Store, Trash2, UserRound, ShieldCheck } from 'lucide-react';
import { formatBrazilPhone } from '@/lib/phone';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';
import { customerPhones, customerAddresses, customerContactPayload } from '@/lib/customer-contact-book';
import { verifiedInternalCustomer } from '@/lib/internal-owner-identity';
import type { Customer, CustomerPhone, CustomerAddress, OrderOrigin } from '@/types';

export interface CustomerFormValue {
  name: string; origin: OrderOrigin; phone?: string; phones?: CustomerPhone[];
  address?: string; addresses?: CustomerAddress[]; neighborhood?: string; maps_link?: string;
  observation?: string; last_confirmation_code?: string; internal_owner_verified?: boolean;
}
interface Props {initial?:Customer;submitLabel:string;busy?:boolean;onSubmit:(value:CustomerFormValue)=>Promise<void>}
const token=()=>Math.random().toString(36).slice(2,10);
export function CustomerForm({initial,submitLabel,busy,onSubmit}:Props){
  const [name,setName]=useState(initial?.name||'');
  const [origin,setOrigin]=useState<OrderOrigin>(initial?.origin||'loja');
  const [phones,setPhones]=useState<CustomerPhone[]>(()=>initial?customerPhones(initial):[]);
  const [addresses,setAddresses]=useState<CustomerAddress[]>(()=>initial?customerAddresses(initial):[]);
  const [observation,setObservation]=useState(initial?.observation||'');
  const [code,setCode]=useState(initial?.last_confirmation_code||'');
  const [isInternal,setIsInternal]=useState(verifiedInternalCustomer(initial));
  const [invalid,setInvalid]=useState('');
  useEffect(()=>{if(!initial)return;setName(initial.name);setOrigin(initial.origin||'loja');setPhones(customerPhones(initial));setAddresses(customerAddresses(initial));setObservation(initial.observation||'');setCode(initial.last_confirmation_code||'');setIsInternal(verifiedInternalCustomer(initial));},[initial]);
  const updatePhone=(id:string,patch:Partial<CustomerPhone>)=>setPhones(list=>list.map(item=>item.id===id?{...item,...patch}:item));
  const updateAddress=(id:string,patch:Partial<CustomerAddress>)=>setAddresses(list=>list.map(item=>item.id===id?{...item,...patch}:item));
  const setPrimaryPhone=(id:string)=>setPhones(list=>list.map(item=>({...item,primary:item.id===id})));
  const setPrimaryAddress=(id:string)=>setAddresses(list=>list.map(item=>({...item,primary:item.id===id})));
  const moveAddressToTop=(id:string)=>setAddresses(list=>{
    const selected=list.find(item=>item.id===id);
    if(!selected) return list;
    return [selected,...list.filter(item=>item.id!==id)];
  });
  const removePhone=(id:string)=>setPhones(list=>{const next=list.filter(item=>item.id!==id);if(next.length&&!next.some(item=>item.primary))next[0]={...next[0],primary:true};return next;});
  const removeAddress=(id:string)=>setAddresses(list=>{const next=list.filter(item=>item.id!==id);if(next.length&&!next.some(item=>item.primary))next[0]={...next[0],primary:true};return next;});
  const save=async(event:React.FormEvent)=>{event.preventDefault();setInvalid('');
    const nonblankPhones=phones.filter(item=>item.number.replace(/\D/g,'').length>0);
    if(nonblankPhones.some(item=>{const n=item.number.replace(/\D/g,'');return n.length!==10&&n.length!==11&&n.length!==12&&n.length!==13;})){setInvalid('Confira o DDD e o número de cada telefone.');return;}
    const normalizedAddresses=addresses.map(item=>{const parsed=canonicalizeOperationalAddress(item.address,item.neighborhood);return {...item,address:parsed.address||item.address,neighborhood:parsed.neighborhood||item.neighborhood};});
    const fields=customerContactPayload(phones,normalizedAddresses);
    if(nonblankPhones.length!==(fields.phones||[]).length){setInvalid('Há telefones duplicados ou incompletos.');return;}
    if(addresses.filter(item=>item.address.trim()).length!==(fields.addresses||[]).length){setInvalid('Há endereços duplicados.');return;}
    await onSubmit({name:name.trim(),origin,...fields,observation:observation.trim()||undefined,last_confirmation_code:origin==='ifood'&&code?code:undefined,internal_owner_verified:isInternal});
  };
  return <form onSubmit={save} className="flex flex-col gap-4 pb-28">
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1">{([['ifood','iFood',Smartphone],['food99','99Food',ShoppingBag],['loja','Loja',Store]] as const).map(([value,label,Icon])=><button key={value} type="button" onClick={()=>setOrigin(value)} className={`flex h-12 items-center justify-center gap-1.5 rounded-xl text-xs font-bold ${origin===value?value==='ifood'?'bg-red-500 text-white':value==='food99'?'bg-yellow-400 text-zinc-950':'bg-emerald-500 text-zinc-950':'text-zinc-400'}`}><Icon size={15}/>{label}</button>)}</div>
    <label className="flex flex-col gap-2"><span className="flex items-center gap-2 text-xs font-bold text-zinc-400"><UserRound size={14}/>Nome do cliente</span><input value={name} onChange={event=>setName(event.target.value)} placeholder="Nome completo" required className="field-input"/></label>
    <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/35 p-3.5"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black text-zinc-100">Telefones</p><p className="text-[11px] text-zinc-500">Escolha o principal; os demais continuam pesquisáveis.</p></div><button type="button" onClick={()=>setPhones(list=>[...list,{id:`phone-${token()}`,number:'',label:'Outro',primary:list.length===0}])} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/[.08] px-3 text-[11px] font-bold text-emerald-300"><Plus size={13}/>Adicionar</button></div>
      <div className="mt-3 space-y-2">{phones.map((item,index)=><div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5"><div className="flex items-center gap-2"><input value={formatBrazilPhone(item.number)} onChange={e=>updatePhone(item.id,{number:e.target.value})} inputMode="tel" aria-label={`Telefone ${index+1}`} placeholder="(34) 99999-9999" className="field-input min-w-0 flex-1"/><button type="button" aria-label="Excluir telefone" onClick={()=>removePhone(item.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-500/20 text-red-300"><Trash2 size={15}/></button></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><input value={item.label||''} onChange={e=>updatePhone(item.id,{label:e.target.value})} placeholder="Ex: WhatsApp, trabalho" className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-[11px] text-zinc-200"/><button type="button" onClick={()=>setPrimaryPhone(item.id)} className={`min-h-9 rounded-lg border px-2 text-[10px] font-bold ${item.primary?'border-emerald-500/40 bg-emerald-500/10 text-emerald-300':'border-zinc-700 text-zinc-400'}`}>{item.primary?'✓ Principal':'Definir principal'}</button></div></div>)}</div>
      {!phones.length&&<p className="mt-3 text-xs text-zinc-500">Nenhum telefone cadastrado. Opcional para pedidos de plataforma.</p>}
    </section>
    <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/35 p-3.5"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black text-zinc-100">Endereços</p><p className="text-[11px] text-zinc-500">Salve Casa, trabalho e outros destinos. O principal será sugerido nas próximas entregas; o histórico não muda.</p></div><button type="button" onClick={()=>setAddresses(list=>[...list,{id:`addr-${token()}`,address:'',label:'Outro endereço',primary:list.length===0}])} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-sky-500/25 bg-sky-500/[.08] px-3 text-[11px] font-bold text-sky-300"><Plus size={13}/>Adicionar</button></div>
      <div className="mt-3 space-y-3">{addresses.map((item,index)=><div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-xs font-bold text-zinc-300"><MapPin size={13}/>{item.primary ? 'Endereço padrão' : `Endereço ${index+1}`}</span><div className="flex items-center gap-1"><button type="button" aria-pressed={Boolean(item.primary)} onClick={()=>setPrimaryAddress(item.id)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold ${item.primary?'border-sky-400/40 bg-sky-400/10 text-sky-300':'border-zinc-700 text-zinc-400'}`}>{item.primary?'✓ Principal':'Tornar principal'}</button><button type="button" onClick={()=>removeAddress(item.id)} aria-label="Excluir endereço" className="grid h-9 w-9 place-items-center rounded-lg border border-red-500/20 text-red-300"><Trash2 size={14}/></button></div></div><div className="space-y-2"><AddressAutocomplete value={item.address} onChange={value=>updateAddress(item.id,{address:value})} label={`Endereço ${index+1}`} placeholder="Rua, número - Bairro" /><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input value={item.label||''} onChange={e=>updateAddress(item.id,{label:e.target.value})} placeholder="Casa, trabalho..." className="field-input"/><input value={item.neighborhood||''} onChange={e=>updateAddress(item.id,{neighborhood:e.target.value})} placeholder="Bairro" className="field-input"/></div><input value={item.maps_link||''} onChange={e=>updateAddress(item.id,{maps_link:e.target.value})} placeholder="Link do Google Maps (opcional)" className="field-input"/><input value={item.reference||''} onChange={e=>updateAddress(item.id,{reference:e.target.value})} placeholder="Referência, portão, instruções" className="field-input"/><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] text-zinc-500">{item.primary ? 'Usado como endereço sugerido.' : 'Permanece disponível para outras entregas.'}</p>{index>0&&<button type="button" onClick={()=>moveAddressToTop(item.id)} className="min-h-9 rounded-lg border border-zinc-700 px-3 text-[10px] font-bold text-zinc-300">Mover para cima</button>}</div></div></div>)}</div>
      {!addresses.length&&<p className="mt-3 text-xs text-zinc-500">Nenhum endereço salvo. Para 99Food com entrega pela plataforma, é opcional.</p>}
    </section>
    <label className="flex flex-col gap-2"><span className="flex items-center gap-2 text-xs font-bold text-zinc-400"><MessageSquare size={14}/>Observações gerais</span><textarea value={observation} onChange={e=>setObservation(e.target.value)} rows={2} className="field-input min-h-20 resize-y py-3" placeholder="Preferências e detalhes do cliente"/></label>
    {origin==='ifood'&&<label className="flex flex-col gap-2 text-xs font-bold text-zinc-500">Último código (apenas referência)<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" className="field-input"/></label>}
    <label className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[.04] p-3 text-xs text-zinc-300"><input type="checkbox" checked={isInternal} onChange={e=>setIsInternal(e.target.checked)} className="mt-0.5 accent-violet-500"/><span><span className="flex items-center gap-1 font-black text-violet-300"><ShieldCheck size={13}/>Cadastro interno DEV verificado</span><span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">Somente para seu cadastro operacional. Não aparece no ranking de clientes; vendas reais continuam nos valores gerais. Não marque homônimos.</span></span></label>
    {invalid&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{invalid}</p>}
    <button disabled={busy||!name.trim()} className="h-14 rounded-2xl bg-amber-400 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/10 disabled:opacity-50">{busy?'Salvando...':submitLabel}</button>
    <style jsx>{`.field-input{min-height:3rem;width:100%;min-width:0;border-radius:.8rem;border:1px solid rgb(39 39 42);background:rgb(24 24 27 / .6);padding:.65rem .8rem;color:rgb(244 244 245);font-size:.8rem;outline:none}.field-input:focus{border-color:rgb(16 185 129)}`}</style>
  </form>;
}
