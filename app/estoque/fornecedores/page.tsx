'use client';
import { useMemo, useRef, useState } from 'react';
import { Beef, Edit3, Flame, Leaf, Package, Plus, Save, Search, ShoppingCart, Store, Truck, X, Bike, Wheat } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { STOCK_SUPPLIER_STYLE, STOCK_SUPPLIER_TYPE_LABELS } from '@/lib/stock-suppliers';
import { claimSubmission, releaseSubmission } from '@/lib/operation/submissionGate';
import type { StockSupplier, StockSupplierType } from '@/types';

const icons = { 'shopping-cart': ShoppingCart, package: Package, beef: Beef, flame: Flame, leaf: Leaf, truck: Truck, bread: Wheat, bike: Bike, store: Store };
const blank = { name: '', type: 'supermercado' as StockSupplierType, phone: '', address: '', observation: '' };

export default function SuppliersPage() {
  const suppliers = useAppStore((state) => state.stockSuppliers);
  const add = useAppStore((state) => state.addStockSupplier);
  const update = useAppStore((state) => state.updateStockSupplier);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StockSupplier | null | undefined>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const saveLock = useRef({ current: false });
  const archiveLocks = useRef(new Set<string>());
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = useMemo(() => suppliers.filter((supplier) =>
    `${supplier.name} ${STOCK_SUPPLIER_TYPE_LABELS[supplier.type] || ''}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  ), [normalizedQuery, suppliers]);
  const activeCount = useMemo(() => suppliers.reduce((count, supplier) => count + Number(supplier.active), 0), [suppliers]);
  const openNew = () => { if (busy || (saveLock.current && editing !== undefined)) return; releaseSubmission(saveLock.current); setForm({ ...blank }); setEditing(null); };
  const openEdit = (supplier: StockSupplier) => {
    if (busy || (saveLock.current && editing !== undefined)) return;
    releaseSubmission(saveLock.current);
    setForm({ name: supplier.name, type: supplier.type, phone: supplier.phone || '', address: supplier.address || '', observation: supplier.observation || '' });
    setEditing(supplier);
  };
  const closeEditor = () => { if (!saveLock.current) setEditing(undefined); };

  const save = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) return toast.error('Informe o nome do fornecedor.');
    if (!claimSubmission(saveLock.current)) return;
    setBusy(true);
    let saved = false;
    try {
      const data = {
        name: form.name.trim(), type: form.type,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        observation: form.observation.trim() || undefined,
      };
      if (editing) await update(editing.id, data);
      else {
        const now = new Date().toISOString();
        await add({ id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...data, active: true, created_at: now, updated_at: now });
      }
      toast.success(editing ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.');
      saved = true;
      setEditing(undefined);
    } catch {
      toast.error('Não foi possível salvar o fornecedor.');
    } finally {
      // Após sucesso, manter a trava até o modal sair da tela.
      if (!saved) releaseSubmission(saveLock.current);
      setBusy(false);
    }
  };

  const toggleArchived = async (supplier: StockSupplier) => {
    if (archiveLocks.current.has(supplier.id)) return;
    archiveLocks.current.add(supplier.id);
    setArchivingId(supplier.id);
    try {
      await update(supplier.id, { active: !supplier.active });
      toast.success(supplier.active ? 'Fornecedor arquivado.' : 'Fornecedor reativado.');
    } catch {
      toast.error('Não foi possível alterar o fornecedor.');
    } finally {
      archiveLocks.current.delete(supplier.id);
      setArchivingId((current) => current === supplier.id ? null : current);
    }
  };

  return <div className="pb-28">
    <PageHeader title="Fornecedores" subtitle={`${activeCount} locais ativos`} to="/estoque" />
    <button onClick={openNew} disabled={busy} className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-50">
      <Plus size={18} />Cadastrar fornecedor
    </button>
    <div className="relative mb-4">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar fornecedor" aria-label="Buscar fornecedor" className="min-h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-zinc-100 outline-none focus:border-amber-500" />
    </div>
    <div className="space-y-2">
      {filtered.length === 0 && <p className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">Nenhum fornecedor encontrado.</p>}
      {filtered.map((supplier) => {
        const style = STOCK_SUPPLIER_STYLE[supplier.type];
        const Icon = icons[style.icon as keyof typeof icons] || Store;
        const archiving = archivingId === supplier.id;
        return <article key={supplier.id} className={`rounded-2xl border p-3 ${supplier.active ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-900 bg-zinc-950/60 opacity-70'}`}>
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${style.className}`}><Icon size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-black text-zinc-100">{supplier.name}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{STOCK_SUPPLIER_TYPE_LABELS[supplier.type]}</p>
            </div>
            <button onClick={() => openEdit(supplier)} disabled={busy || archiving} aria-label={`Editar ${supplier.name}`} className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800 text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50"><Edit3 size={16} /></button>
          </div>
          {(supplier.address || supplier.phone) && <p className="mt-2 break-words text-xs text-zinc-500">{[supplier.phone, supplier.address].filter(Boolean).join(' · ')}</p>}
          <button onClick={() => void toggleArchived(supplier)} disabled={archiving} className={`mt-3 min-h-10 w-full rounded-xl text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 ${supplier.active ? 'bg-zinc-800 text-zinc-300' : 'bg-emerald-500/10 text-emerald-400'}`}>{archiving ? 'Salvando...' : supplier.active ? 'Arquivar fornecedor' : 'Reativar fornecedor'}</button>
        </article>;
      })}
    </div>
    {editing !== undefined && <div onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }} className="fixed inset-0 z-[90] flex items-end bg-black/80 p-3 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={editing ? 'Editar fornecedor' : 'Novo fornecedor'} className="mx-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[26px] border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-heading text-lg font-black text-zinc-100">{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</h2><p className="mt-1 text-xs text-zinc-500">Cadastro sincronizado na nuvem.</p></div>
          <button onClick={closeEditor} disabled={busy} aria-label="Fechar formulário" className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-zinc-400 disabled:opacity-50"><X size={18} /></button>
        </div>
        <input autoFocus value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Nome do fornecedor" aria-label="Nome do fornecedor" className="mt-5 min-h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 outline-none focus:border-amber-500" />
        <div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(STOCK_SUPPLIER_TYPE_LABELS).map(([type, label]) => <button key={type} onClick={() => setForm((value) => ({ ...value, type: type as StockSupplierType }))} aria-pressed={form.type === type} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${form.type === type ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-zinc-800 text-zinc-500'}`}>{label}</button>)}</div>
        {(['phone', 'address', 'observation'] as const).map((key) => <input key={key} value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} placeholder={key === 'phone' ? 'Telefone (opcional)' : key === 'address' ? 'Endereço (opcional)' : 'Observação (opcional)'} aria-label={key === 'phone' ? 'Telefone' : key === 'address' ? 'Endereço' : 'Observação'} className="mt-3 min-h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 outline-none focus:border-amber-500" />)}
        <button onClick={() => void save()} disabled={busy} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-50"><Save size={18} />{busy ? 'Salvando...' : 'Salvar fornecedor'}</button>
      </div>
    </div>}
  </div>;
}
