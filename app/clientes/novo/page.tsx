// R309 — Cadastro assistido: telefone sugere, proprietario decide.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, MapPin, Phone, ShieldCheck, UsersRound, X } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { CustomerForm, type CustomerFormValue } from '@/components/customers/CustomerForm';
import { findExistingCustomer, normalizeCustomerName } from '@/lib/customer-identity';
import { customerAddresses, customerPhones } from '@/lib/customer-contact-book';
import { customerPhoneLinkSuggestions, manualCustomerContactPatch } from '@/lib/customer-link-review';
import { useAppStore } from '@/store/useAppStore';
import type { Customer } from '@/types';

type Review = {value:CustomerFormValue; candidates:Customer[]};

export default function NewCustomerPage() {
  const router=useRouter();
  const addCustomer=useAppStore(state=>state.addCustomer);
  const updateCustomer=useAppStore(state=>state.updateCustomer);
  const customers=useAppStore(state=>state.customers);
  const [busy,setBusy]=useState(false);
  const [review,setReview]=useState<Review|null>(null);

  const createSeparate=async(value:CustomerFormValue)=>{
    setBusy(true);
    try {
      const now=new Date().toISOString();
      const customer:Customer={
        id:`customer-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,
        createdAt:now, updated_at:now, ...value,
      };
      await addCustomer(customer);
      setReview(null);
      toast.success('Cliente cadastrado com sucesso.');
      router.push(`/clientes/details?id=${customer.id}`);
    } catch {
      toast.error('Não foi possível cadastrar o cliente.');
    } finally { setBusy(false); }
  };

  const save=async(value:CustomerFormValue)=>{
    if(busy)return;
    const current=useAppStore.getState().customers;
    const sameIdentity=findExistingCustomer(current,value.name,{address:value.address,phone:value.phone});
    const byPhone=customerPhoneLinkSuggestions(current,{name:value.name,phone:value.phone,phones:value.phones});
    const candidates=[...byPhone.map(item=>item.customer)];
    if(sameIdentity && !candidates.some(item=>item.id===sameIdentity.id))candidates.unshift(sameIdentity);
    if(candidates.length){setReview({value,candidates});return;}
    await createSeparate(value);
  };

  const link=async(customerId:string)=>{
    if(!review||busy)return;
    const chosen=useAppStore.getState().customers.find(item=>item.id===customerId);
    if(!chosen){toast.error('Cadastro alterado; pesquise novamente.');setReview(null);return;}
    const nameMatches=normalizeCustomerName(chosen.name)===normalizeCustomerName(review.value.name);
    if(!nameMatches){toast.error('Nomes diferentes: confira as pessoas antes de vincular.');return;}
    const stillEligible=customerPhoneLinkSuggestions([chosen],{name:review.value.name,phone:review.value.phone,phones:review.value.phones}).length>0 ||
      findExistingCustomer([chosen],review.value.name,{address:review.value.address,phone:review.value.phone})?.id===chosen.id;
    if(!stillEligible){toast.error('O telefone ou endereço deixou de conferir. Revise o cadastro.');return;}
    setBusy(true);
    try {
      await updateCustomer(chosen.id,manualCustomerContactPatch(chosen,review.value));
      setReview(null);
      toast.success('Contato e endereço adicionados ao cliente existente.',{description:'Endereço principal e pedidos anteriores preservados.'});
      router.push(`/clientes/details?id=${chosen.id}`);
    } catch {toast.error('Não foi possível acrescentar os endereços. Nenhum cliente novo foi criado.');}
    finally {setBusy(false);}
  };

  return <div>
    <PageHeader title="Novo cliente" subtitle="Um cliente, vários endereços" to="/clientes"/>
    <CustomerForm submitLabel="Conferir e cadastrar cliente" busy={busy} onSubmit={save}/>
    {review&&<div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 px-3 pb-4 backdrop-blur-sm sm:items-center" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="r309-review-title" className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
        <header className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-300"><UsersRound size={20}/></div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Possível cadastro existente</p><h2 id="r309-review-title" className="mt-1 text-lg font-black text-zinc-100">Evitar cliente duplicado</h2></div>
          <button type="button" disabled={busy} onClick={()=>setReview(null)} aria-label="Voltar para edição" className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 text-zinc-300"><X size={18}/></button>
        </header>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">Encontramos telefone ou identidade de endereço já cadastrados. Um telefone pode ser compartilhado por várias pessoas: confirme o nome completo antes de reaproveitar. Nenhuma unificação é automática.</p>
        <div className="mt-4 space-y-2">
          {review.candidates.map(customer=>{
            const exactName=normalizeCustomerName(customer.name)===normalizeCustomerName(review.value.name);
            const existingAddresses=customerAddresses(customer);
            return <div key={customer.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="truncate text-sm font-black text-zinc-100">{customer.name}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400"><Phone size={12}/>{customerPhones(customer).length} contato(s)</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400"><MapPin size={12}/>{existingAddresses.length} endereço(s) — {customer.address||'Sem principal'}</p>
              {!exactName&&<p className="mt-2 text-[11px] text-amber-300">Nome diferente. Telefone compartilhado não autoriza vínculo.</p>}
              <button type="button" disabled={busy||!exactName} onClick={()=>void link(customer.id)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-black text-zinc-950 disabled:opacity-40"><ShieldCheck size={15}/>Usar este cliente e adicionar endereços <ArrowRight size={14}/></button>
            </div>;
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={()=>setReview(null)} className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-xs font-bold text-zinc-200">Voltar e conferir</button>
          <button type="button" disabled={busy} onClick={()=>void createSeparate(review.value)} className="min-h-12 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2 text-xs font-black text-amber-300">É outra pessoa · criar separado</button>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Adicionar endereço mantém os pedidos antigos, o endereço principal e o histórico. Para trocar o principal, edite o cliente posteriormente.</p>
      </section>
    </div>}
  </div>;
}
