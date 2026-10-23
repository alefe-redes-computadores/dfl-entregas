'use client';
import { useEffect, useState } from 'react';
import { MapPin, Phone, X, Check, ArrowRight } from 'lucide-react';
import type { Customer, CustomerPhone, CustomerAddress } from '@/types';
import { customerPhones, customerAddresses } from '@/lib/customer-contact-book';
import { formatBrazilPhone } from '@/lib/phone';

interface Props { customer:Customer; onClose:()=>void; onConfirm:(phone:CustomerPhone|undefined,address:CustomerAddress|undefined)=>void; }
export function CustomerDestinationSheet({customer,onClose,onConfirm}:Props){
  const phones=customerPhones(customer),addresses=customerAddresses(customer);
  const [phoneId,setPhoneId]=useState(phones.find(item=>item.primary)?.id||phones[0]?.id||'');
  const [addressId,setAddressId]=useState(addresses.find(item=>item.primary)?.id||addresses[0]?.id||'');
  useEffect(() => {
    setPhoneId(phones.find(item => item.primary)?.id || phones[0]?.id || '');
    setAddressId(addresses.find(item => item.primary)?.id || addresses[0]?.id || '');
  }, [customer.id]);
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc);},[onClose]);
  return <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`Contatos e endereços de ${customer.name}`} onClick={e=>e.stopPropagation()} className="dfl-bottom-sheet safe-bottom max-h-[89dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-zinc-700 bg-zinc-950 p-4 pb-[calc(var(--dfl-safe-bottom)+20px)] shadow-2xl">
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-700"/>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-400">Dados do pedido</p><h2 className="mt-1 truncate text-lg font-black text-zinc-100">{customer.name}</h2><p className="mt-1 text-xs leading-relaxed text-zinc-400">Escolha o telefone e o endereço desta entrega. O histórico não muda.</p></div><button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-400"><X size={19}/></button></div>
      {phones.length>0&&<div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-xs font-black text-zinc-300"><Phone size={15} className="text-emerald-400"/>Qual telefone?</h3><div className="space-y-2">{phones.map(item=><button key={item.id} type="button" onClick={()=>setPhoneId(item.id)} aria-pressed={phoneId===item.id} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-xs ${item.id===phoneId?'border-emerald-400/50 bg-emerald-500/10 text-zinc-100':'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}><span className="min-w-0 break-all">{formatBrazilPhone(item.number)} <small className="text-zinc-500">{item.label||''}{item.primary?' · principal':''}</small></span>{phoneId===item.id&&<Check size={15} className="shrink-0 text-emerald-400"/>}</button>)}</div></div>}
      {addresses.length>0&&<div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-xs font-black text-zinc-300"><MapPin size={15} className="text-sky-400"/>Qual endereço?</h3><div className="space-y-2">{addresses.map(item=><button key={item.id} type="button" onClick={()=>setAddressId(item.id)} aria-pressed={addressId===item.id} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs ${item.id===addressId?'border-sky-400/50 bg-sky-500/10 text-zinc-100':'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}><span className="min-w-0"><strong className="block font-bold">{item.label||'Endereço'}{item.primary?' · principal':''}</strong><span className="mt-1 block break-words text-zinc-400">{item.address}</span>{item.reference&&<span className="mt-1 block text-zinc-500">{item.reference}</span>}</span>{addressId===item.id&&<Check size={15} className="shrink-0 text-sky-400"/>}</button>)}</div></div>}
      <button onClick={()=>onConfirm(phones.find(item=>item.id===phoneId),addresses.find(item=>item.id===addressId))} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-zinc-950">Usar nesta entrega <ArrowRight size={17}/></button>
    </section>
  </div>
}
