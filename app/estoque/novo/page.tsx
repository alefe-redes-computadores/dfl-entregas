// app/estoque/novo/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { formatBRLCents, moneyToNumber } from '@/lib/money-input';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { StockCategoryPicker } from '@/components/stock/StockCategoryPicker';
import type { StockProduct, StockSupplyUnit } from '@/types';

const numberValue = (value: string) => Number(value.replace(',', '.')) || 0;
const inputClass = 'mt-2 h-14 w-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-base text-zinc-100 outline-none focus:border-emerald-500';

export default function NewStockProductPage() {
  const router = useRouter(); const add = useAppStore(s => s.addStockProduct);
  const [name,setName]=useState(''); const [category,setCategory]=useState(''); const [unit,setUnit]=useState<StockSupplyUnit>('un');
  const [current,setCurrent]=useState('0'); const [minimum,setMinimum]=useState('0'); const [ideal,setIdeal]=useState(''); const [cost,setCost]=useState('R$ 0,00'); const [busy,setBusy]=useState(false);
  const currentNumber=numberValue(current);const minimumNumber=numberValue(minimum);const target=Math.max(minimumNumber,numberValue(ideal));const suggestion=Math.max(0,target-currentNumber);
  const invalidIdeal=ideal!==''&&numberValue(ideal)<minimumNumber;
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!name.trim())return;if(invalidIdeal)return toast.error('O nível de reposição não pode ser menor que o nível de alerta.');setBusy(true);try{const now=new Date().toISOString();const product:StockProduct={id:`stock-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:name.trim(),category:category.trim()||undefined,unit,current_quantity:currentNumber,minimum_quantity:minimumNumber,ideal_quantity:target,average_cost:moneyToNumber(cost)||undefined,active:true,created_at:now,updated_at:now};await add(product);toast.success('Produto adicionado ao estoque.');router.replace('/estoque')}catch{toast.error('Não foi possível cadastrar o produto.');setBusy(false)}};
  return <div><PageHeader title="Novo produto" subtitle="Saldo, alerta e reposição" to="/estoque"/><form onSubmit={submit} className="space-y-5 pb-10">
    <TextField label="Produto*" value={name} set={setName} placeholder="Ex.: Coca-Cola 2L" required/><label className="block text-xs font-bold text-zinc-400">Categoria<StockCategoryPicker value={category} onChange={setCategory}/></label>
    <div><p className="mb-2 text-xs font-bold text-zinc-400">Unidade de controle</p><div className="flex flex-wrap gap-2">{Object.entries(SUPPLY_UNIT_LABELS).map(([key,label])=><button type="button" key={key} onClick={()=>setUnit(key as StockSupplyUnit)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${unit===key?'border-emerald-500/50 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{label}</button>)}</div></div>
    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4"><h2 className="font-heading text-sm font-black text-zinc-200">Controle de quantidade</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">O alerta avisa que está acabando. A reposição define até onde completar a compra.</p><div className="mt-4 grid grid-cols-2 gap-3"><NumberField label="Quantidade atual" hint="Quanto existe agora" value={current} set={setCurrent}/><NumberField label="Avisar quando chegar em" hint="Nível mínimo" value={minimum} set={setMinimum}/><NumberField label="Repor até" hint="Meta após a compra" value={ideal} set={setIdeal} placeholder={minimum||'0'}/><label className="min-w-0 text-xs font-bold text-zinc-400">Custo por unidade<span className="mt-1 block text-[9px] font-normal text-zinc-600">Valor médio atual</span><input inputMode="numeric" value={cost} onChange={e=>setCost(formatBRLCents(e.target.value))} className={inputClass}/></label></div>
      {invalidIdeal&&<p className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-[10px] font-bold text-red-300"><AlertCircle size={14}/>“Repor até” precisa ser igual ou maior que o alerta.</p>}
    </section>
    <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400"><ShoppingCart size={18}/></span><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Prévia da sugestão</p><p className="mt-1 text-sm font-bold text-zinc-200">Comprar {formatStockQuantity(suggestion,unit)}</p><p className="mt-1 text-[9px] text-zinc-600">Você tem {formatStockQuantity(currentNumber,unit)} · meta {formatStockQuantity(target,unit)}</p></div></div>
    <button disabled={busy||invalidIdeal} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 disabled:opacity-40"><Save size={18}/>{busy?'Salvando...':'Cadastrar produto'}</button>
  </form></div>;
}
function TextField({label,value,set,placeholder,required}:{label:string;value:string;set:(v:string)=>void;placeholder?:string;required?:boolean}){return <label className="block text-xs font-bold text-zinc-400">{label}<input value={value} onChange={e=>set(e.target.value)} className={inputClass} placeholder={placeholder} required={required}/></label>}
function NumberField({label,hint,value,set,placeholder='0'}:{label:string;hint:string;value:string;set:(v:string)=>void;placeholder?:string}){return <label className="min-w-0 text-xs font-bold text-zinc-400">{label}<span className="mt-1 block text-[9px] font-normal text-zinc-600">{hint}</span><input inputMode="decimal" value={value} onChange={e=>set(e.target.value.replace(/[^0-9.,]/g,''))} className={inputClass} placeholder={placeholder}/></label>}
