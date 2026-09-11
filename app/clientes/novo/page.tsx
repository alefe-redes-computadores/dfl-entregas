// app/clientes/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { CustomerForm, type CustomerFormValue } from '@/components/customers/CustomerForm';
import { findExistingCustomer } from '@/lib/customer-identity';
import { useAppStore } from '@/store/useAppStore';
import type { Customer } from '@/types';

export default function NewCustomerPage(){const router=useRouter();const addCustomer=useAppStore(state=>state.addCustomer);const customers=useAppStore(state=>state.customers);const [busy,setBusy]=useState(false);const save=async(value:CustomerFormValue)=>{const duplicate=findExistingCustomer(customers,value.name,{address:value.address,phone:value.phone});if(duplicate){toast.error('Este cliente já parece estar cadastrado.',{description:'Nome, endereço e telefone foram considerados antes de reutilizar o cadastro.'});router.push(`/clientes/details?id=${duplicate.id}`);return;}setBusy(true);try{const now=new Date().toISOString();const customer:Customer={id:`customer-${Date.now()}`,createdAt:now,updated_at:now,...value};await addCustomer(customer);toast.success('Cliente cadastrado com sucesso.');router.push(`/clientes/details?id=${customer.id}`);}catch{toast.error('Não foi possível cadastrar o cliente.');}finally{setBusy(false);}};return <div><PageHeader title="Novo cliente" subtitle="Cadastro e endereço principal" to="/clientes"/><CustomerForm submitLabel="Cadastrar cliente" busy={busy} onSubmit={save}/></div>;}
