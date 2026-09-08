// components/stock-supplies/StockSupplyForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { PackagePlus, Plus, Save, Trash2 } from 'lucide-react';
import type { PaymentMethod, StockSupply, StockSupplyItem, StockSupplyStatus, StockSupplyUnit } from '@/types';
import { SUPPLY_STATUS_LABELS, SUPPLY_UNIT_LABELS, supplyTotal } from '@/lib/stock-supply';
import { TeamMemberPicker } from '@/components/team/TeamMemberPicker';
import { useAppStore } from '@/store/useAppStore';

export type StockSupplyFormValue = Omit<StockSupply, 'id' | 'created_at' | 'updated_at'>;
type DraftItem = StockSupplyItem & { quantity_text: string; unit_price_text: string };

const parseMoney = (value: string) => {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const decimal = (value?: number) => value ? String(value).replace('.', ',') : '';
const newItem = (): DraftItem => ({ id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', quantity: 1, unit: 'un', quantity_text: '1', unit_price_text: '' });
const localDateTime = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function StockSupplyForm({ initial, defaultBuyerName, busy, submitLabel, onSubmit }: {
  initial?: StockSupply; defaultBuyerName?: string; busy?: boolean; submitLabel: string;
  onSubmit: (value: StockSupplyFormValue) => Promise<void>;
}) {
  const stockProducts = useAppStore((state) => state.stockProducts.filter((product) => product.active));
  const [occurredAt, setOccurredAt] = useState(localDateTime(initial?.occurred_at));
  const [status, setStatus] = useState<StockSupplyStatus>(initial?.status || 'solicitado');
  const [supplier, setSupplier] = useState(initial?.supplier || '');
  const [purchaserName, setPurchaserName] = useState(initial?.purchaser_name || defaultBuyerName || 'Álefe');
  const [purchaserId, setPurchaserId] = useState(initial?.purchaser_id || '');
  const [transport, setTransport] = useState(decimal(initial?.transport_amount));
  const [otherCosts, setOtherCosts] = useState(decimal(initial?.other_costs));
  const [payment, setPayment] = useState<PaymentMethod | ''>(initial?.payment_method || '');
  const [observation, setObservation] = useState(initial?.observation || '');
  const [items, setItems] = useState<DraftItem[]>(initial?.items?.length ? initial.items.map((item) => ({ ...item, quantity_text: decimal(item.quantity), unit_price_text: decimal(item.unit_price) })) : [newItem()]);

  const normalizedItems = useMemo(() => items.map(({ quantity_text, unit_price_text, ...item }) => {
    const quantity = parseMoney(quantity_text);
    const unitPrice = parseMoney(unit_price_text);
    return { ...item, name: item.name.trim(), quantity, unit_price: unitPrice || undefined, total_price: unitPrice ? Number((quantity * unitPrice).toFixed(2)) : undefined };
  }).filter((item) => item.name && item.quantity > 0), [items]);
  const productsAmount = supplyTotal({ items: normalizedItems, total_amount: 0 });
  const transportAmount = parseMoney(transport);
  const otherCostsAmount = parseMoney(otherCosts);
  const total = Number((productsAmount + transportAmount + otherCostsAmount).toFixed(2));
  const field = 'mt-2 h-14 w-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-base text-zinc-100 outline-none focus:border-amber-500';
  const update = (id: string, data: Partial<DraftItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...data } : item));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!occurredAt || !normalizedItems.length) return;
    const now = new Date().toISOString();
    await onSubmit({ occurred_at: new Date(occurredAt).toISOString(), status, items: normalizedItems, products_amount: productsAmount, transport_amount: transportAmount || undefined, other_costs: otherCostsAmount || undefined, total_amount: total, supplier: supplier.trim() || undefined, payment_method: payment || undefined, purchaser_id: purchaserId || undefined, purchaser_name: purchaserName.trim() || undefined, observation: observation.trim() || undefined, received_at: status === 'recebido' || status === 'conferido' ? initial?.received_at || now : undefined, checked_at: status === 'conferido' ? initial?.checked_at || now : undefined });
  };

  return <form onSubmit={submit} className="flex flex-col gap-5 pb-28">
    <section className="rounded-[26px] border border-amber-500/20 bg-amber-500/[.05] p-4">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400"><PackagePlus size={20}/></div><div><p className="font-heading text-sm font-black text-zinc-100">Compra para reposição</p><p className="mt-1 text-[10px] text-zinc-500">Registre produtos, transporte e custo real da compra.</p></div></div>
    </section>
    <label className="text-xs font-bold text-zinc-400">Data e hora<input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={field} required/></label>
    <div><p className="mb-2 text-xs font-bold text-zinc-400">Situação</p><div className="grid grid-cols-2 gap-2">{(Object.entries(SUPPLY_STATUS_LABELS) as [StockSupplyStatus,string][]).map(([key,label]) => <button type="button" key={key} onClick={() => setStatus(key)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${status===key?'border-amber-500/50 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{label}</button>)}</div></div>
    <div><p className="mb-2 text-xs font-bold text-zinc-400">Comprado por</p><TeamMemberPicker value={purchaserId} onChange={(member) => { setPurchaserId(member.id); setPurchaserName(member.name); }}/></div>
    <label className="text-xs font-bold text-zinc-400">Fornecedor / local<input value={supplier} onChange={(e)=>setSupplier(e.target.value)} placeholder="Ex.: supermercado, distribuidora..." className={field}/></label>
    <section className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-zinc-200">Itens da compra*</p><p className="text-[10px] text-zinc-600">Adicione quantos produtos precisar.</p></div><button type="button" onClick={()=>setItems(c=>[...c,newItem()])} className="flex h-10 items-center gap-1 rounded-xl bg-amber-500/10 px-3 text-xs font-black text-amber-400"><Plus size={14}/>Item</button></div>
      {items.map((item,index)=><article key={item.id} className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-zinc-600">Item {index+1}</p>{items.length>1&&<button type="button" onClick={()=>setItems(c=>c.filter(x=>x.id!==item.id))} className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-400"><Trash2 size={15}/></button>}</div><input value={item.name} onChange={(e)=>update(item.id,{name:e.target.value,stock_product_id:undefined})} placeholder="Nome do produto" className={field}/><label className="mt-3 block text-[10px] font-bold text-zinc-500">Vínculo com o estoque<select value={item.stock_product_id || ''} onChange={(e)=>{const product=stockProducts.find((candidate)=>candidate.id===e.target.value);update(item.id,{stock_product_id:product?.id,name:product?.name||item.name,unit:product?.unit||item.unit});}} className={`${field} mt-1 appearance-none`}><option value="">Selecionar na conferência</option>{stockProducts.map((product)=><option key={product.id} value={product.id}>{product.name} · {SUPPLY_UNIT_LABELS[product.unit]}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="min-w-0 text-[10px] font-bold text-zinc-500">Quantidade<input inputMode="decimal" value={item.quantity_text} onChange={(e)=>update(item.id,{quantity_text:e.target.value})} placeholder="Qtd." className={`${field} mt-1`}/></label><label className="min-w-0 text-[10px] font-bold text-zinc-500">Preço por unidade<input inputMode="decimal" value={item.unit_price_text} onChange={(e)=>update(item.id,{unit_price_text:e.target.value})} placeholder="R$ 0,00" className={`${field} mt-1`}/></label></div><div className="mt-3 flex flex-wrap gap-2">{Object.entries(SUPPLY_UNIT_LABELS).map(([key,label])=><button type="button" key={key} disabled={Boolean(item.stock_product_id)} onClick={()=>update(item.id,{unit:key as StockSupplyUnit})} className={`rounded-xl border px-3 py-2 text-[11px] font-bold disabled:opacity-50 ${item.unit===key?'border-amber-500/50 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{label}</button>)}</div></article>)}
    </section>
    <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-zinc-400">Uber / frete<input inputMode="decimal" value={transport} onChange={(e)=>setTransport(e.target.value)} placeholder="0,00" className={field}/></label><label className="text-xs font-bold text-zinc-400">Outros custos<input inputMode="decimal" value={otherCosts} onChange={(e)=>setOtherCosts(e.target.value)} placeholder="0,00" className={field}/></label></div>
    <div><p className="mb-2 text-xs font-bold text-zinc-400">Pagamento</p><div className="grid grid-cols-2 gap-2">{([['','Não informado'],['dinheiro','Dinheiro'],['pix','Pix'],['cartao','Cartão']] as const).map(([key,label])=><button type="button" key={label} onClick={()=>setPayment(key)} className={`h-11 rounded-xl border text-xs font-bold ${payment===key?'border-amber-500/50 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{label}</button>)}</div></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.05] p-4"><p className="text-[10px] font-bold text-zinc-500">Produtos + transporte + outros</p><p className="mt-2 font-heading text-2xl font-black text-emerald-400">{total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p></div>
    <label className="text-xs font-bold text-zinc-400">Observação<textarea value={observation} onChange={(e)=>setObservation(e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-100 outline-none focus:border-amber-500" placeholder="Faltas, substituições, comprovante..."/></label>
    <button disabled={busy||!normalizedItems.length} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-40"><Save size={18}/>{busy?'Salvando...':submitLabel}</button>
  </form>;
}
