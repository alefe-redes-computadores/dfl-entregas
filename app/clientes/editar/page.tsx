// app/clientes/editar/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { CustomerForm, type CustomerFormValue } from '@/components/customers/CustomerForm';
import { useAppStore } from '@/store/useAppStore';

function EditContent(){const router=useRouter();const id=useSearchParams().get('id');const customer=useAppStore(state=>state.customers.find(item=>item.id===id));const updateCustomer=useAppStore(state=>state.updateCustomer);const [busy,setBusy]=useState(false);if(!customer)return <div><PageHeader title="Cliente não encontrado" to="/clientes"/><p className="py-16 text-center text-sm text-zinc-500">O cadastro pode ter sido removido.</p></div>;const save=async(value:CustomerFormValue)=>{setBusy(true);try{await updateCustomer(customer.id,value);toast.success('Cliente atualizado com sucesso.');router.push(`/clientes/details?id=${customer.id}`);}catch{toast.error('Não foi possível atualizar o cliente.');}finally{setBusy(false);}};return <div><PageHeader title="Editar cliente" subtitle={customer.name} to={`/clientes/details?id=${customer.id}`}/><CustomerForm initial={customer} submitLabel="Salvar alterações" busy={busy} onSubmit={save}/></div>;}
export default function EditCustomerPage(){return <Suspense fallback={<p className="py-16 text-center text-zinc-500">Carregando...</p>}><EditContent/></Suspense>;}
