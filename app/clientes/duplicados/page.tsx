// app/clientes/duplicados/page.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronLeft,
  GitMerge,
  MapPin,
  PackageOpen,
  Phone,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { customerDuplicateCandidates } from '@/lib/customer-duplicates';
import { customerDuplicateGroups, directDuplicateEvidence, customerUnverifiedNameGroups } from '@/lib/customer-duplicate-groups';
import { customerAddresses, customerPhones } from '@/lib/customer-contact-book';
import type { Customer } from '@/types';

const address = (customer: Customer) =>
  customer.address || customer.neighborhood || 'Sem endereço';

export default function CustomerDuplicatesPage() {
  const router = useRouter();
  const customers = useAppStore((state) => state.customers);
  const deliveries = useAppStore((state) => state.deliveries);
  const mergeCustomers = useAppStore((state) => state.mergeCustomers);
  const [busy, setBusy] = useState<string | null>(null);
  const mergeInFlight = useRef(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [visibleGroups, setVisibleGroups] = useState(12);
  const [primaryByGroup, setPrimaryByGroup] = useState<Record<string,string>>({});
  const [search, setSearch] = useState('');
  const [pendingMerge, setPendingMerge] = useState<{
    source: Customer;
    target: Customer;
    key: string;
  } | null>(null);

  const allCandidates = useMemo(
    () => customerDuplicateCandidates(customers, deliveries),
    [customers, deliveries],
  );
  const groupsCount = useMemo(() => new Set(allCandidates.map(candidate =>
    candidate.left.name.replace(/\s*\(\d+\)\s*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  )).size, [allCandidates]);
  const candidates = useMemo(() => {
    const term = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (!term) return allCandidates;
    return allCandidates.filter(candidate =>
      [candidate.left.name,candidate.right.name,candidate.left.phone,candidate.right.phone,
       candidate.left.address,candidate.right.address]
        .some(value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term))
    );
  }, [allCandidates, search]);

  const allGroups = useMemo(()=>customerDuplicateGroups(allCandidates),[allCandidates]);
  const unverifiedGroups = useMemo(()=>customerUnverifiedNameGroups(customers,allCandidates),[customers,allCandidates]);
  const filteredUnverified = useMemo(()=>{
    const term=search.trim().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    return unverifiedGroups.filter(group=>!term || group.members.some(c=>
      [c.name,c.phone,c.address].some(value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(term))));
  },[unverifiedGroups,search]);
  const filteredGroups = useMemo(()=>{
    const term=search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!term)return allGroups;
    return allGroups.filter(group=>group.members.some(row=>[
      row.customer.name,row.customer.phone,row.customer.address,
      ...customerPhones(row.customer).map(item=>item.number),
      ...customerAddresses(row.customer).map(item=>item.address),
    ].some(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term))));
  },[allGroups,search]);

  const requestMerge = (
    source: Customer,
    target: Customer,
    key: string,
  ) => {
    setPendingMerge({ source, target, key });
  };

  const confirmMerge = async () => {
    if (!pendingMerge || mergeInFlight.current) return;
    mergeInFlight.current = true;
    const { source, target, key } = pendingMerge;
    setBusy(key);

    try {
      const result = await mergeCustomers(source.id, target.id);
      setPendingMerge(null);
      toast.success('Clientes unificados com segurança.', {
        description: `${result.deliveriesMoved} entrega(s) transferida(s).`,
      });
    } catch (error) {
      toast.error('Não foi possível unificar os clientes.', {
        description:
          error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      mergeInFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/clientes')}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">
            Higiene de dados
          </p>
          <h1 className="font-heading text-xl font-bold text-zinc-50">
            Possíveis duplicados
          </h1>
        </div>
      </header>

      <section className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/[.06] p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={20} />
          <div>
            <p className="text-sm font-black text-zinc-100">
              Nada é apagado automaticamente
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              O app apenas sugere pares. Você escolhe qual cadastro permanece.
              O nome e o telefone precisam conferir. Endereços diferentes serão preservados como destinos do mesmo cliente.
              As entregas são repontadas antes da remoção do duplicado. Um telefone igual pode pertencer a pessoas diferentes: confira cada confirmação.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-[18px] border border-zinc-800 bg-zinc-900/35 p-3">
        <label htmlFor="r299-customer-duplicate-search" className="mb-2 block text-xs font-bold text-zinc-300">Encontrar grupo por nome, telefone ou endereço</label>
        <input id="r299-customer-duplicate-search" type="search" value={search}
          onChange={event => {setSearch(event.target.value);setVisibleCount(30);}}
          placeholder="Ex.: Claudio, rua ou telefone"
          className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-amber-400" />
        <p className="mt-2 text-[11px] text-zinc-500">{groupsCount} nome(s) com pares confirmados · {allGroups.length} grupo(s) verificáveis · {unverifiedGroups.length} grupo(s) pendente(s) de confirmação. A mesclagem continua manual.</p>
      </div>
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-zinc-500">
          {filteredGroups.length+filteredUnverified.length} grupo(s) para revisar
        </p>
        <UsersRound size={17} className="text-zinc-600" />
      </div>

      <div className="space-y-3">
        {filteredGroups.slice(0,visibleGroups).map(group=>{
          const chosen=group.members.find(row=>row.customer.id===primaryByGroup[group.key])||group.members[0];
          return <section key={group.key} className="rounded-[24px] border border-amber-500/20 bg-zinc-900/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Grupo para revisão</p><h2 className="mt-1 text-base font-black text-zinc-100">{group.name}</h2><p className="mt-1 text-[11px] text-zinc-500">{group.members.length} cadastros · {group.totalOrders} pedidos vinculados</p></div>
              <span className="rounded-lg border border-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">Escolha o principal</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">Um único grupo pode conter vários endereços. Nenhum pedido será movido até você confirmar a união de cada par. O cadastro escolhido mantém seu endereço principal.</p>
            <div className="mt-3 space-y-2">
              {group.members.map(row=>{
                const selected=row.customer.id===chosen.customer.id;
                const evidence=selected?undefined:directDuplicateEvidence(group,chosen.customer.id,row.customer.id);
                return <div key={row.customer.id} className={`rounded-2xl border p-3 ${selected?'border-emerald-500/40 bg-emerald-500/[.06]':'border-zinc-800 bg-zinc-950/50'}`}>
                  <button type="button" disabled={Boolean(busy)} onClick={()=>setPrimaryByGroup(old=>({...old,[group.key]:row.customer.id}))} aria-pressed={selected} className="flex min-h-10 w-full items-center gap-2 text-left">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs ${selected?'border-emerald-400 text-emerald-400':'border-zinc-600 text-zinc-600'}`}>{selected?'●':''}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-zinc-100">{row.customer.name}</strong><small className="text-[10px] text-zinc-500">{row.orderCount} pedido(s) · {customerAddresses(row.customer).length} endereço(s) · {customerPhones(row.customer).length} telefone(s)</small></span>
                    {selected&&<span className="text-[10px] font-black text-emerald-400">PRINCIPAL</span>}
                  </button>
                  <p className="mt-1 truncate text-[11px] text-zinc-500">{row.customer.address||'Endereço não informado'}</p>
                  {!selected&&(evidence ? <button type="button" disabled={Boolean(busy)} onClick={()=>requestMerge(row.customer,chosen.customer,`${row.customer.id}:${chosen.customer.id}`)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-[11px] font-black text-amber-200 disabled:opacity-40"><GitMerge size={14}/>Incorporar ao principal · {evidence.score}%</button> :
                    <p className="mt-2 text-[10px] text-amber-400">Sem prova direta com o principal. Não mesclar por encadeamento: revise o par individualmente.</p>)}
                </div>;
              })}
            </div>
          </section>;
        })}
        {filteredGroups.length>visibleGroups&&<button type="button" className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200" onClick={()=>setVisibleGroups(v=>v+12)}>Mostrar mais grupos · {filteredGroups.length-visibleGroups} restantes</button>}
      </div>

      {filteredUnverified.length>0&&<details className="rounded-[22px] border border-sky-500/20 bg-zinc-900/30 p-3">
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-black text-sky-300">Nomes repetidos sem telefone confirmado · {filteredUnverified.length} grupo(s)</summary>
        <p className="mb-3 text-[11px] leading-relaxed text-zinc-400">Nome parecido sozinho não prova que é a mesma pessoa. Esses registros são para conferir; primeiro atualize os telefones e endereços no cadastro. Não existe botão de mesclagem nessa lista.</p>
        {filteredUnverified.slice(0,30).map(group=><div key={group.key} className="mb-3 rounded-xl border border-zinc-800 p-3">
          <p className="text-xs font-black text-zinc-200">{group.name} · {group.members.length} cadastros</p>
          <p className="mt-1 text-[10px] text-zinc-500">{group.unverifiedCount} sem prova suficiente</p>
          {group.members.map(customer=><button key={customer.id} type="button" onClick={()=>router.push(`/clientes/details?id=${customer.id}`)} className="mt-2 flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 text-left text-[11px] text-zinc-300"><span className="truncate">{customer.name} · {customer.address||'Sem endereço'}</span><ArrowRight size={13}/></button>)}
        </div>)}
        {filteredUnverified.length>30&&<p className="text-[10px] text-zinc-500">Mostrando 30 grupos. Pesquise pelo nome para localizar os demais.</p>}
      </details>}

      <details className="rounded-[22px] border border-zinc-800 bg-zinc-900/30 p-3">
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-black text-zinc-300">Comparações individuais (opcional) · {candidates.length} pares</summary>
      <div className="mt-3 space-y-3">
        {candidates.slice(0, visibleCount).map((candidate) => {
          const key = `${candidate.left.id}:${candidate.right.id}`;
          return (
            <section
              key={key}
              className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-3"
            >
              <details className="group">
                <summary className="cursor-pointer list-none rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" aria-label={`Comparar ${candidate.left.name} e ${candidate.right.name}`}>
                  <div className="flex items-center gap-3 text-left">
                    <GitMerge size={17} className="shrink-0 text-amber-400" />
                    <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-zinc-100">{candidate.left.name} · {candidate.right.name}</strong>
                      <span className="mt-1 block text-[10px] text-zinc-500">{candidate.score}% de semelhança · Toque para comparar</span></span>
                    <ChevronLeft size={16} className="shrink-0 -rotate-90 text-zinc-500 transition-transform group-open:rotate-90" />
                  </div>
                </summary>
              <div className="mt-3 border-t border-zinc-800/70 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    {candidate.score}% de semelhança
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {candidate.reasons.join(' · ')}
                  </p>
                </div>
                <GitMerge size={19} className="text-amber-400" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[candidate.left, candidate.right].map((customer) => {
                  const orders =
                    customer.id === candidate.left.id
                      ? candidate.leftOrders
                      : candidate.rightOrders;
                  return (
                    <div
                      key={customer.id}
                      className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3"
                    >
                      <p className="truncate text-sm font-black text-zinc-100">
                        {customer.name}
                      </p>
                      <p className="mt-2 flex items-center gap-1 truncate text-[10px] text-zinc-500">
                        <MapPin size={10} />
                        {address(customer)} · {customerAddresses(customer).length} endereço(s)
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-zinc-500">
                        <Phone size={10} />
                        {customer.phone || 'Sem telefone'} · {customerPhones(customer).length} contato(s)
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                        <PackageOpen size={10} />
                        {orders} pedido(s)
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => requestMerge(candidate.right, candidate.left, key)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-zinc-100 px-2 text-[10px] font-black text-zinc-950 disabled:opacity-50"
                >
                  Manter {candidate.left.name}
                  <ArrowRight size={12} />
                </button>
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => requestMerge(candidate.left, candidate.right, key)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-black text-zinc-200 disabled:opacity-50"
                >
                  Manter {candidate.right.name}
                  <ArrowRight size={12} />
                </button>
              </div>
              </div>
              </details>
            </section>
          );
        })}

        {candidates.length > visibleCount && (
          <button type="button" onClick={() => setVisibleCount((count) => count + 30)} className="w-full rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-300">
            Mostrar mais 30 pares · {candidates.length - visibleCount} restantes
          </button>
        )}
        {!candidates.length && (
          <div className="rounded-[26px] border border-dashed border-zinc-800 py-16 text-center">
            <ShieldCheck className="mx-auto text-emerald-500" size={30} />
            <p className="mt-3 font-bold text-zinc-200">
              Nenhum duplicado provável
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              A base de clientes está limpa pelas regras atuais.
            </p>
          </div>
        )}
      </div>

      </details>

      {pendingMerge && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-3 pb-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setPendingMerge(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-customer-title"
            className="w-full max-w-md rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-800 sm:hidden" />

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                <GitMerge size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">
                  Confirmar consolidação
                </p>
                <h2
                  id="merge-customer-title"
                  className="mt-1 text-lg font-black text-zinc-50"
                >
                  Manter {pendingMerge.target.name}?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  O cadastro {pendingMerge.source.name} será incorporado ao principal.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
                    Sai
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-zinc-400">
                    {pendingMerge.source.name}
                  </p>
                </div>
                <ArrowRight size={16} className="text-amber-400" />
                <div className="min-w-0 text-right">
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500/70">
                    Fica
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-zinc-100">
                    {pendingMerge.target.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs leading-relaxed text-zinc-500">
              <p>• Todas as entregas serão transferidas para o cadastro mantido.</p>
              <p>• Todos os endereços e telefones válidos serão preservados, sem substituir o endereço principal.</p>
              <p>• Histórico e totais serão recalculados.</p>
              <p>• O duplicado só será removido no mesmo lote após atualizar as referências.</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setPendingMerge(null)}
                className="h-12 rounded-2xl border border-zinc-800 bg-zinc-900 text-sm font-black text-zinc-300 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={confirmMerge}
                className="h-12 rounded-2xl bg-amber-500 text-sm font-black text-zinc-950 disabled:opacity-50"
              >
                {busy ? 'Unificando...' : 'Unificar clientes'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
