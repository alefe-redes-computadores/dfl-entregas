'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Phone, X, Check, ArrowRight, Plus } from 'lucide-react';
import type { Customer, CustomerPhone, CustomerAddress } from '@/types';
import { customerPhones, customerAddresses } from '@/lib/customer-contact-book';
import { formatBrazilPhone } from '@/lib/phone';

interface Props { customer:Customer; onClose:()=>void; onConfirm:(phone:CustomerPhone|undefined,address:CustomerAddress|undefined)=>void; onAddAddress?:(address:string,makePrimary:boolean)=>Promise<CustomerAddress|undefined>; onUseTemporary?:(phone:CustomerPhone|undefined,address:string)=>void; }
export function CustomerDestinationSheet({customer,onClose,onConfirm,onAddAddress,onUseTemporary}:Props){
  const phones=customerPhones(customer),addresses=customerAddresses(customer);
  const [phoneId,setPhoneId]=useState(phones.find(item=>item.primary)?.id||phones[0]?.id||'');
  const [addressId,setAddressId]=useState(addresses.find(item=>item.primary)?.id||addresses[0]?.id||'');
  const [newAddress,setNewAddress]=useState('');
  const [temporaryAddress,setTemporaryAddress]=useState('');
  const [adding,setAdding]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [makePrimary,setMakePrimary]=useState(false);
  const [addError,setAddError]=useState('');
  const [addedAddress,setAddedAddress]=useState<CustomerAddress>();
  const selectAddress=addedAddress && addressId===addedAddress.id ? addedAddress : addresses.find(item=>item.id===addressId);
  const saveAddress=async()=>{
    if(!onAddAddress||adding||newAddress.trim().length<8)return;
    setAdding(true);setAddError('');
    try{
      const saved=await onAddAddress(newAddress.trim(),makePrimary);
      if(saved){setAddedAddress(saved);setAddressId(saved.id);setShowAdd(false);setNewAddress('');setMakePrimary(false);}
      else setAddError('Endereço não foi salvo. Revise os dados e tente novamente.');
    }catch{setAddError('Não foi possível salvar o endereço. Tente novamente.');}
    finally{setAdding(false);}
  };
  useEffect(() => {
    setPhoneId(phones.find(item => item.primary)?.id || phones[0]?.id || '');
    setAddressId(addresses.find(item => item.primary)?.id || addresses[0]?.id || '');
  }, [customer.id]);
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc);},[onClose]);
  // Portal: um modal aberto dentro de um card transformado nao pode ficar preso a ele.
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-[310] flex items-end justify-center overflow-hidden bg-black/75 backdrop-blur-sm" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`Contatos e endereços de ${customer.name}`} onClick={e=>e.stopPropagation()} className="dfl-bottom-sheet safe-bottom max-h-[calc(100dvh-12px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-zinc-700 bg-zinc-950 p-4 pb-[max(34px,env(safe-area-inset-bottom))] shadow-2xl">
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-700"/>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-400">Dados do pedido</p><h2 className="mt-1 truncate text-lg font-black text-zinc-100">{customer.name}</h2><p className="mt-1 text-xs leading-relaxed text-zinc-400">Escolha o telefone e o destino desta entrega. O endereço padrão só será alterado se você marcar essa opção ao cadastrar outro local.</p></div><button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-400"><X size={19}/></button></div>
      {phones.length>0&&<div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-xs font-black text-zinc-300"><Phone size={15} className="text-emerald-400"/>Qual telefone?</h3><div className="space-y-2">{phones.map(item=><button key={item.id} type="button" onClick={()=>setPhoneId(item.id)} aria-pressed={phoneId===item.id} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-xs ${item.id===phoneId?'border-emerald-400/50 bg-emerald-500/10 text-zinc-100':'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}><span className="min-w-0 break-all">{formatBrazilPhone(item.number)} <small className="text-zinc-500">{item.label||''}{item.primary?' · principal':''}</small></span>{phoneId===item.id&&<Check size={15} className="shrink-0 text-emerald-400"/>}</button>)}</div></div>}
      {addresses.length>0&&<div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-xs font-black text-zinc-300"><MapPin size={15} className="text-sky-400"/>Qual endereço?</h3><div className="space-y-2">{addresses.map(item=><button key={item.id} type="button" onClick={()=>setAddressId(item.id)} aria-pressed={addressId===item.id} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs ${item.id===addressId?'border-sky-400/50 bg-sky-500/10 text-zinc-100':'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}><span className="min-w-0"><strong className="block font-bold">{item.label||'Endereço'}{item.primary?' · principal':''}</strong><span className="mt-1 block break-words text-zinc-400">{item.address}</span>{item.reference&&<span className="mt-1 block text-zinc-500">{item.reference}</span>}{item.maps_link&&<span className="mt-1 block text-[10px] text-sky-300">Localização do Maps vinculada</span>}</span>{addressId===item.id&&<Check size={15} className="shrink-0 text-sky-400"/>}</button>)}</div></div>}
      {addedAddress&&<p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">Novo endereço salvo no cadastro: {addedAddress.address}</p>}
      {onAddAddress && <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/[.04] p-3">
        <button type="button" onClick={()=>setShowAdd(v=>!v)} aria-expanded={showAdd} className="flex min-h-10 w-full items-center gap-2 text-left text-xs font-black text-sky-300"><Plus size={16}/> Cadastrar outro endereço para este cliente</button>
        {showAdd&&<div className="mt-2 space-y-2"><label className="block text-[11px] font-semibold text-zinc-300" htmlFor="dfl-extra-address">Novo destino (rua, número, bairro)</label><textarea id="dfl-extra-address" value={newAddress} onChange={e=>setNewAddress(e.target.value)} rows={2} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100" placeholder="Rua, número, bairro, Patos de Minas"/><label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-[11px] text-zinc-300"><input type="checkbox" checked={makePrimary} onChange={e=>setMakePrimary(e.target.checked)} className="h-4 w-4 accent-sky-400"/>Definir este novo endereço como padrão</label><p className="text-[10px] text-zinc-500">{makePrimary ? "O novo endereço será sugerido nos próximos pedidos. Entregas antigas não mudam." : "O endereço padrão atual será preservado. O novo ficará disponível nos próximos pedidos."} Salvar o destino é diferente de concluir a entrega.</p>{addError&&<p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{addError}</p>}<button type="button" disabled={adding||newAddress.trim().length<8} onClick={()=>void saveAddress()} className="min-h-11 w-full rounded-xl bg-sky-500 text-xs font-black text-zinc-950 disabled:opacity-40">{adding?'Salvando...':'Salvar endereço no cliente'}</button></div>}
      </div>}
      <button type="button" disabled={adding || showAdd} onClick={()=>onConfirm(phones.find(item=>item.id===phoneId),selectAddress)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-zinc-950">Usar nesta entrega <ArrowRight size={17}/></button>
      {onUseTemporary&&<div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/[.055] p-3">
        <p className="text-xs font-black text-violet-200">Outro destino, só neste pedido</p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Use quando o cliente pedir entrega em outro local sem cadastrá-lo como endereço permanente. O pedido manterá seu destino próprio.</p>
        <label className="mt-3 block text-[11px] font-semibold text-zinc-300" htmlFor="dfl-temporary-destination">Rua, número e bairro do destino temporário</label>
        <textarea id="dfl-temporary-destination" rows={2} value={temporaryAddress} onChange={event=>setTemporaryAddress(event.target.value)} placeholder="Rua, número, bairro" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100"/>
        <button type="button" disabled={adding||temporaryAddress.trim().length<8} onClick={()=>onUseTemporary?.(phones.find(item=>item.id===phoneId),temporaryAddress.trim())} className="mt-2 min-h-12 w-full rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 text-xs font-black text-violet-100 disabled:opacity-40">Usar só nesta entrega · não salvar no cliente</button>
      </div>}
    </section>
  </div>, document.body);
}
