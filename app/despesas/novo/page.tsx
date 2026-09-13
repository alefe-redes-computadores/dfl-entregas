'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bike, BriefcaseBusiness, ChevronLeft, Ellipsis, Package,
  ReceiptText, Save, Truck, Utensils, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { OperationalExpenseType } from '@/types';

const OPTIONS:Array<{value:OperationalExpenseType;label:string;description:string;Icon:typeof Bike}>=[
  {value:'motoboy',label:'Motoboy',description:'Diária, complemento, ajuda ou custo ligado ao entregador',Icon:Bike},
  {value:'frete',label:'Frete',description:'Frete avulso ou deslocamento contratado',Icon:Truck},
  {value:'manutencao',label:'Manutenção',description:'Reparo, peça ou manutenção operacional',Icon:Wrench},
  {value:'taxa',label:'Taxa',description:'Taxas, tarifas e cobranças operacionais',Icon:ReceiptText},
  {value:'alimentacao',label:'Alimentação',description:'Refeição ou alimentação ligada à operação',Icon:Utensils},
  {value:'servico',label:'Serviço',description:'Serviço terceirizado ou apoio operacional',Icon:BriefcaseBusiness},
  {value:'material',label:'Material',description:'Material operacional fora do estoque controlado',Icon:Package},
  {value:'outro',label:'Outro',description:'Despesa operacional sem categoria específica',Icon:Ellipsis},
];
const localDateTime=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};

export default function NewExpensePage(){
  const router=useRouter();
  const add=useAppStore(s=>s.addOperationalExpense);
  const motoboys=useAppStore(s=>s.motoboys);
  const [type,setType]=useState<OperationalExpenseType>('motoboy');
  const [description,setDescription]=useState('');
  const [amount,setAmount]=useState('');
  const [occurredAt,setOccurredAt]=useState(localDateTime);
  const [motoboyId,setMotoboyId]=useState('');
  const [observation,setObservation]=useState('');
  const [saving,setSaving]=useState(false);
  const activeMotoboys=useMemo(()=>motoboys.filter(m=>m.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[motoboys]);
  const needsMotoboy=type==='motoboy'||type==='frete';

  const save=async()=>{if(saving)return;const numeric=Number(amount.replace(/\./g,'').replace(',','.'));if(!description.trim())return void toast.error('Informe a descrição da despesa.');if(!Number.isFinite(numeric)||numeric<=0)return void toast.error('Informe um valor válido.');if(!occurredAt)return void toast.error('Informe a data da despesa.');const m=motoboys.find(x=>x.id===motoboyId);const now=new Date().toISOString();setSaving(true);try{await add({id:`expense-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,occurred_at:new Date(occurredAt).toISOString(),type,description:description.trim(),amount:numeric,motoboy_id:m?.id,motoboy_name:m?.name,source_kind:'manual',observation:observation.trim()||undefined,created_at:now,updated_at:now});toast.success('Despesa registrada.');router.replace('/despesas')}catch(error){toast.error('Não foi possível salvar a despesa.',{description:error instanceof Error?error.message:undefined})}finally{setSaving(false)}};

  return <div className="dfl-page">
    <header className="flex items-center gap-3"><button onClick={()=>router.replace('/despesas')} className="dfl-icon-button"><ChevronLeft size={20}/></button><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-rose-400">Novo lançamento</p><h1 className="font-heading text-xl font-black text-zinc-100">Nova despesa</h1></div></header>

    <section className="space-y-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-zinc-600">Categoria</p><h2 className="mt-0.5 text-sm font-black text-zinc-200">O que gerou este custo?</h2></div><div className="grid grid-cols-2 gap-2">{OPTIONS.map(({value,label,description:help,Icon})=>{const active=type===value;return <button key={value} onClick={()=>{setType(value);if(value!=='motoboy'&&value!=='frete')setMotoboyId('')}} className={`min-h-[104px] rounded-[20px] border p-3 text-left transition active:scale-[.98] ${active?'border-rose-400/35 bg-rose-500/[.08]':'border-zinc-800 bg-zinc-900/40'}`}><span className={`grid h-9 w-9 place-items-center rounded-xl ${active?'bg-rose-500/15 text-rose-300':'bg-zinc-950/60 text-zinc-500'}`}><Icon size={17}/></span><p className="mt-2 text-xs font-black text-zinc-200">{label}</p><p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-zinc-600">{help}</p></button>})}</div></section>

    <section className="space-y-3 rounded-[24px] border border-zinc-800/80 bg-zinc-900/35 p-4">
      <Field label="Descrição"><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: diária do João, troca de óleo, taxa..." className="dfl-search px-3.5"/></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Valor"><input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^\d.,]/g,''))} inputMode="decimal" placeholder="0,00" className="dfl-search px-3.5"/></Field><Field label="Quando"><input type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} className="dfl-search px-2.5 text-[11px]"/></Field></div>
      {needsMotoboy&&<Field label="Motoboy relacionado · opcional"><select value={motoboyId} onChange={e=>setMotoboyId(e.target.value)} className="dfl-search px-3.5"><option value="">Sem vínculo</option>{activeMotoboys.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>}
      <Field label="Observação · opcional"><textarea value={observation} onChange={e=>setObservation(e.target.value)} rows={3} placeholder="Detalhe útil para lembrar depois" className="w-full resize-none rounded-[16px] border border-zinc-800/80 bg-zinc-950/55 px-3.5 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-rose-500/50"/></Field>
    </section>

    <div className="rounded-[20px] border border-zinc-800/70 bg-zinc-900/25 p-3"><p className="text-[10px] leading-relaxed text-zinc-600">Compras de estoque e abastecimentos continuam nos módulos próprios. Aqui entram outras despesas da operação para evitar dupla contagem.</p></div>
    <button disabled={saving} onClick={save} className="flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-rose-500 text-sm font-black text-white active:scale-[.98] disabled:opacity-50"><Save size={17}/>{saving?'Salvando...':'Salvar despesa'}</button>
  </div>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">{label}</span>{children}</label>}
