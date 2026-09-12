// components/customers/CustomerForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { MapPin, MessageSquare, Smartphone, Store, UserRound } from 'lucide-react';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';
import type { Customer, OrderOrigin } from '@/types';

export interface CustomerFormValue {
  name: string;
  phone?: string;
  origin: OrderOrigin;
  address?: string;
  neighborhood?: string;
  maps_link?: string;
  observation?: string;
  last_confirmation_code?: string;
}

interface Props { initial?: Customer; submitLabel: string; busy?: boolean; onSubmit: (value: CustomerFormValue) => Promise<void>; }
const phoneMask = (value: string) => { const digits=value.replace(/\D/g,'').slice(0,11); if(digits.length<=2)return digits;if(digits.length<=7)return `(${digits.slice(0,2)}) ${digits.slice(2)}`;return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`; };

export function CustomerForm({initial,submitLabel,busy,onSubmit}:Props) {
  const [name,setName]=useState(initial?.name||'');
  const [phone,setPhone]=useState(initial?.phone?phoneMask(initial.phone):'');
  const [origin,setOrigin]=useState<OrderOrigin>(initial?.origin||'loja');
  const [address,setAddress]=useState(initial?.address||'');
  const [neighborhood,setNeighborhood]=useState(initial?.neighborhood||'');
  const [mapsLink,setMapsLink]=useState(initial?.maps_link||'');
  const [observation,setObservation]=useState(initial?.observation||'');
  const [code,setCode]=useState(initial?.last_confirmation_code||'');

  useEffect(()=>{if(!initial)return;setName(initial.name);setPhone(initial.phone?phoneMask(initial.phone):'');setOrigin(initial.origin||'loja');setAddress(initial.address||'');setNeighborhood(initial.neighborhood||'');setMapsLink(initial.maps_link||'');setObservation(initial.observation||'');setCode(initial.last_confirmation_code||'');},[initial]);

  return <form onSubmit={async event=>{event.preventDefault();const normalized=canonicalizeOperationalAddress(address,neighborhood);const mergedObservation=Array.from(new Set([observation.trim(),...normalized.observations].filter(Boolean))).join(' - ');await onSubmit({name:name.trim(),phone:phone.replace(/\D/g,'')||normalized.phone||undefined,origin,address:normalized.address||undefined,neighborhood:normalized.neighborhood||neighborhood.trim()||undefined,maps_link:mapsLink.trim()||undefined,observation:mergedObservation||undefined,last_confirmation_code:origin==='ifood'&&code?code:undefined});}} className="flex flex-col gap-5 pb-10">
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1"><button type="button" onClick={()=>setOrigin('ifood')} className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold ${origin==='ifood'?'bg-red-500 text-white':'text-zinc-500'}`}><Smartphone size={17}/>iFood</button><button type="button" onClick={()=>setOrigin('loja')} className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold ${origin==='loja'?'bg-emerald-500 text-zinc-950':'text-zinc-500'}`}><Store size={17}/>Loja</button></div>
    <Field icon={UserRound} label="Nome do cliente" required><input value={name} onChange={event=>setName(event.target.value)} placeholder="Nome completo" required className="field-input"/></Field>
    <Field icon={MessageSquare} label="WhatsApp"><input value={phone} onChange={event=>setPhone(phoneMask(event.target.value))} inputMode="tel" placeholder="(34) 99999-9999" className="field-input"/></Field>
    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/30 p-4"><AddressAutocomplete value={address} onChange={setAddress} label="Endereço principal" placeholder="Rua, número - Bairro"/><div className="mt-3 grid grid-cols-2 gap-3"><input value={neighborhood} onChange={event=>setNeighborhood(event.target.value)} placeholder="Bairro" className="field-input"/><input value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" placeholder="Código iFood" disabled={origin!=='ifood'} className="field-input disabled:opacity-40"/></div><div className="relative mt-3"><MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400"/><input value={mapsLink} onChange={event=>setMapsLink(event.target.value)} placeholder="Link do Google Maps" className="field-input pl-10"/></div></div>
    <Field icon={MessageSquare} label="Observações"><textarea value={observation} onChange={event=>setObservation(event.target.value)} rows={3} placeholder="Referência, portão, instruções..." className="field-input h-auto resize-none py-3"/></Field>
    <button disabled={busy||!name.trim()} className="h-14 rounded-2xl bg-amber-500 font-black text-zinc-950 shadow-lg shadow-amber-500/15 active:scale-[0.98] disabled:opacity-50">{busy?'Salvando...':submitLabel}</button>
    <style jsx>{`.field-input{height:3.25rem;width:100%;border-radius:1rem;border:1px solid rgb(39 39 42);background:rgb(24 24 27/.55);padding-left:1rem;padding-right:1rem;color:rgb(244 244 245);font-size:.875rem;outline:none}.field-input:focus{border-color:rgb(16 185 129)}`}</style>
  </form>;
}

function Field({icon:Icon,label,required,children}:{icon:typeof UserRound;label:string;required?:boolean;children:React.ReactNode}) { return <label className="flex flex-col gap-2"><span className="flex items-center gap-2 px-1 text-xs font-bold text-zinc-400"><Icon size={14}/>{label}{required&&<span className="text-amber-400">*</span>}</span>{children}</label>; }
