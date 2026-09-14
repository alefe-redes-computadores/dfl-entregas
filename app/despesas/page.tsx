'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bike,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Ellipsis,
  FileDown,
  Pencil,
  Package,
  PieChart,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  Truck,
  UserRound,
  Utensils,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAppStore } from '@/store/useAppStore';
import type { OperationalExpense, OperationalExpenseType } from '@/types';

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const META: Record<
  OperationalExpenseType,
  { label: string; Icon: typeof Bike; tone: string; iconTone: string }
> = {
  motoboy: {
    label: 'Motoboy',
    Icon: Bike,
    tone: 'border-sky-500/20 bg-sky-500/[.04]',
    iconTone: 'bg-sky-500/10 text-sky-400',
  },
  frete: {
    label: 'Frete',
    Icon: Truck,
    tone: 'border-violet-500/20 bg-violet-500/[.04]',
    iconTone: 'bg-violet-500/10 text-violet-400',
  },
  manutencao: {
    label: 'Manutenção',
    Icon: Wrench,
    tone: 'border-amber-500/20 bg-amber-500/[.04]',
    iconTone: 'bg-amber-500/10 text-amber-400',
  },
  taxa: {
    label: 'Taxa',
    Icon: ReceiptText,
    tone: 'border-rose-500/20 bg-rose-500/[.04]',
    iconTone: 'bg-rose-500/10 text-rose-400',
  },
  alimentacao: {
    label: 'Alimentação',
    Icon: Utensils,
    tone: 'border-orange-500/20 bg-orange-500/[.04]',
    iconTone: 'bg-orange-500/10 text-orange-400',
  },
  servico: {
    label: 'Serviço',
    Icon: BriefcaseBusiness,
    tone: 'border-indigo-500/20 bg-indigo-500/[.04]',
    iconTone: 'bg-indigo-500/10 text-indigo-400',
  },
  material: {
    label: 'Material',
    Icon: Package,
    tone: 'border-emerald-500/20 bg-emerald-500/[.04]',
    iconTone: 'bg-emerald-500/10 text-emerald-400',
  },
  outro: {
    label: 'Outro',
    Icon: Ellipsis,
    tone: 'border-zinc-800 bg-zinc-900/45',
    iconTone: 'bg-zinc-800 text-zinc-400',
  },
};

type SourceFilter = 'todas' | 'manual' | 'motoboy_settlement';

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const dayKey = (value: string) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export default function ExpensesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const expenses = useAppStore((state) => state.operationalExpenses);
  const motoboys = useAppStore((state) => state.motoboys);
  const remove = useAppStore((state) => state.deleteOperationalExpense);

  const [month, setMonth] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OperationalExpenseType | 'todas'>('todas');
  const [source, setSource] = useState<SourceFilter>(
    searchParams.get('source') === 'motoboy_settlement' ? 'motoboy_settlement' : 'todas',
  );
  const [motoboyFilter, setMotoboyFilter] = useState(searchParams.get('motoboy') || 'todos');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OperationalExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const monthly = useMemo(
    () =>
      expenses.filter(
        (item) => monthKey(new Date(item.occurred_at)) === monthKey(month),
      ),
    [expenses, month],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');

    return monthly
      .filter((item) => type === 'todas' || item.type === type)
      .filter(
        (item) =>
          source === 'todas' ||
          (item.source_kind || 'manual') === source,
      )
      .filter((item) => motoboyFilter === 'todos' || item.motoboy_id === motoboyFilter)
      .filter((item) => {
        if (!term) return true;
        return [
          item.description,
          item.motoboy_name,
          item.observation,
          META[item.type]?.label,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(term);
      })
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() -
          new Date(a.occurred_at).getTime(),
      );
  }, [monthly, motoboyFilter, query, source, type]);

  const grouped = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, OperationalExpense[]>>((acc, item) => {
          (acc[dayKey(item.occurred_at)] ||= []).push(item);
          return acc;
        }, {}),
      ).sort(([a], [b]) => b.localeCompare(a)),
    [filtered],
  );

  const analytics = useMemo(() => {
    const total = monthly.reduce((sum, item) => sum + item.amount, 0);
    const byType = monthly.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + item.amount;
      return acc;
    }, {});
    const byMotoboy = monthly
      .filter((item) => item.motoboy_name)
      .reduce<Record<string, number>>((acc, item) => {
        const key = item.motoboy_name || 'Sem motoboy';
        acc[key] = (acc[key] || 0) + item.amount;
        return acc;
      }, {});

    const categories = Object.entries(byType)
      .map(([key, value]) => ({
        key: key as OperationalExpenseType,
        value,
        percent: total ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const motoboyRanking = Object.entries(byMotoboy)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      total,
      count: monthly.length,
      average: monthly.length ? total / monthly.length : 0,
      categories,
      motoboyRanking,
      activeMotoboys: motoboys.filter((item) => item.active).length,
    };
  }, [monthly, motoboys]);

  const moveMonth = (dir: number) =>
    setMonth(
      (value) =>
        new Date(value.getFullYear(), value.getMonth() + dir, 1),
    );

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;

    setDeleting(true);
    try {
      await remove(pendingDelete.id);
      toast.success('Despesa removida.');
      setPendingDelete(null);
    } catch {
      toast.error('Não foi possível remover a despesa.');
    } finally {
      setDeleting(false);
    }
  };

  const exportPdf = () => {
    if (!filtered.length) {
      toast.info('Não há despesas neste filtro para exportar.');
      return;
    }

    const period = month.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });

    const rows = filtered
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(new Date(item.occurred_at).toLocaleDateString('pt-BR'))}</td>
            <td>${escapeHtml(META[item.type]?.label || item.type)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.motoboy_name || '—')}</td>
            <td class="money">${escapeHtml(money(item.amount))}</td>
          </tr>
        `,
      )
      .join('');

    const categoryRows = analytics.categories
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(META[item.key]?.label || item.key)}</td>
            <td class="money">${escapeHtml(money(item.value))}</td>
            <td class="money">${item.percent.toFixed(1)}%</td>
          </tr>
        `,
      )
      .join('');

    const report = window.open('', '_blank', 'noopener,noreferrer');
    if (!report) {
      toast.error('O navegador bloqueou a janela do relatório.');
      return;
    }

    report.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>DFL Entregas — Despesas ${escapeHtml(period)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
            h1 { margin: 0; font-size: 22px; }
            .muted { color: #666; font-size: 12px; margin-top: 4px; }
            .summary { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 22px 0; }
            .box { border: 1px solid #ddd; border-radius: 10px; padding: 12px; }
            .box b { display: block; font-size: 18px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
            th { font-size: 10px; text-transform: uppercase; color: #555; }
            .money { text-align: right; white-space: nowrap; }
            h2 { font-size: 14px; margin-top: 24px; }
            footer { margin-top: 24px; color: #777; font-size: 10px; }
            @media print {
              body { margin: 14mm; }
              button { display: none !important; }
            }
          </style>
        </head>
        <body>
          <h1>DFL Entregas — Despesas operacionais</h1>
          <div class="muted">Período: ${escapeHtml(period)} · filtros atuais aplicados</div>
          <div class="summary">
            <div class="box">Total<b>${escapeHtml(money(filtered.reduce((s, i) => s + i.amount, 0)))}</b></div>
            <div class="box">Lançamentos<b>${filtered.length}</b></div>
            <div class="box">Média<b>${escapeHtml(money(filtered.reduce((s, i) => s + i.amount, 0) / filtered.length))}</b></div>
          </div>
          <h2>Resumo por categoria</h2>
          <table>
            <thead><tr><th>Categoria</th><th class="money">Valor</th><th class="money">Participação</th></tr></thead>
            <tbody>${categoryRows}</tbody>
          </table>
          <h2>Lançamentos</h2>
          <table>
            <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Motoboy</th><th class="money">Valor</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <footer>Gerado pelo DFL Entregas em ${escapeHtml(new Date().toLocaleString('pt-BR'))}.</footer>
          <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
        </body>
      </html>
    `);
    report.document.close();
  };

  return (
    <div className="dfl-page">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.replace('/loja')}
            className="dfl-icon-button"
            aria-label="Voltar para Minha Loja"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-rose-400">
              Custos da operação
            </p>
            <h1 className="font-heading text-xl font-black text-zinc-100">
              Despesas
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="dfl-icon-button"
            aria-label="Exportar despesas em PDF"
          >
            <FileDown size={18} />
          </button>

        </div>
      </header>

      <section className="flex items-center justify-between rounded-[20px] border border-zinc-800/80 bg-zinc-900/45 p-2">
        <button onClick={() => moveMonth(-1)} className="dfl-icon-button h-9 w-9">
          <ChevronLeft size={17} />
        </button>

        <div className="text-center">
          <CalendarDays size={15} className="mx-auto text-rose-400" />
          <p className="mt-1 text-sm font-black capitalize text-zinc-200">
            {month.toLocaleDateString('pt-BR', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <button onClick={() => moveMonth(1)} className="dfl-icon-button h-9 w-9">
          <ChevronRight size={17} />
        </button>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-zinc-800/80 bg-zinc-900/35">
        <div className="border-b border-zinc-800/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-zinc-600">
                Total do período
              </p>
              <p className="mt-1 font-heading text-2xl font-black text-rose-300">
                {money(analytics.total)}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {analytics.count} lançamento{analytics.count === 1 ? '' : 's'} · média {money(analytics.average)}
              </p>
            </div>

            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
              <CircleDollarSign size={20} />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-zinc-800/70">
          <Mini label="Categorias" value={String(analytics.categories.length)} />
          <Mini label="Motoboys ativos" value={String(analytics.activeMotoboys)} />
          <Mini
            label="Maior grupo"
            value={
              analytics.categories[0]
                ? META[analytics.categories[0].key]?.label || analytics.categories[0].key
                : '—'
            }
          />
        </div>
      </section>

      {analytics.categories.length > 0 && (
        <section className="rounded-[22px] border border-zinc-800/70 bg-zinc-900/30 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <PieChart size={15} className="text-rose-400" />
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-zinc-500">
              Distribuição
            </p>
          </div>

          <div className="space-y-2.5">
            {analytics.categories.slice(0, 5).map((item) => {
              const meta = META[item.key] || META.outro;
              const Icon = meta.Icon;

              return (
                <div key={item.key}>
                  <div className="flex items-center gap-2">
                    <Icon size={13} className="text-zinc-500" />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-zinc-400">
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-black text-zinc-300">
                      {money(item.value)}
                    </span>
                    <span className="w-10 text-right text-[9px] text-zinc-700">
                      {item.percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-rose-400/70"
                      style={{ width: `${Math.max(2, item.percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {analytics.motoboyRanking.length > 0 && (
        <section className="rounded-[22px] border border-sky-500/10 bg-sky-500/[.025] p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <UserRound size={15} className="text-sky-400" />
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-zinc-500">
              Movimentações por motoboy
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {analytics.motoboyRanking.map((item) => (
              <div
                key={item.name}
                className="min-w-[130px] rounded-xl border border-zinc-800/70 bg-zinc-950/35 px-3 py-2.5"
              >
                <p className="truncate text-[10px] font-black text-zinc-300">
                  {item.name}
                </p>
                <p className="mt-1 text-xs font-black text-sky-300">
                  {money(item.value)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="relative">
        <Search
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar descrição, motoboy ou observação"
          className="dfl-search pl-11 pr-4 focus:border-rose-500/50"
        />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setFiltersOpen(true)} className={`flex h-11 items-center gap-2 rounded-[14px] border px-3.5 text-[10px] font-black ${(type !== 'todas' || source !== 'todas' || motoboyFilter !== 'todos')?'border-rose-400/30 bg-rose-500/10 text-rose-300':'border-zinc-800 bg-zinc-900/45 text-zinc-500'}`}>
          <SlidersHorizontal size={15} />Filtros
          {(Number(type !== 'todas') + Number(source !== 'todas') + Number(motoboyFilter !== 'todos')) > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[8px] text-white">{Number(type !== 'todas') + Number(source !== 'todas') + Number(motoboyFilter !== 'todos')}</span>}
        </button>
        {(type !== 'todas' || source !== 'todas' || motoboyFilter !== 'todos') && <button type="button" onClick={() => {setType('todas');setSource('todas');setMotoboyFilter('todos')}} className="h-11 rounded-[14px] px-3 text-[10px] font-black text-zinc-600">Limpar</button>}
      </div>

      {filtersOpen && <div className="fixed inset-0 z-[120] flex items-end bg-black/75 p-3 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)setFiltersOpen(false)}}>
        <section className="dfl-bottom-sheet mx-auto w-full max-w-md p-5 pb-7">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-rose-400">Despesas</p><h2 className="mt-1 font-heading text-lg font-black text-zinc-100">Filtrar lançamentos</h2></div><button onClick={()=>setFiltersOpen(false)} className="dfl-icon-button"><X size={17}/></button></div>
          <ExpenseFilter label="Categoria" value={type} setValue={value=>setType(value as OperationalExpenseType|'todas')} options={[['todas','Todas'],...(Object.keys(META) as OperationalExpenseType[]).map(key=>[key,META[key].label] as [string,string])]} />
          <ExpenseFilter label="Origem" value={source} setValue={value=>setSource(value as SourceFilter)} options={[['todas','Todas as origens'],['manual','Manuais'],['motoboy_settlement','Acertos']]} />
          <ExpenseFilter label="Motoboy" value={motoboyFilter} setValue={setMotoboyFilter} options={[['todos','Todos'],...motoboys.map(item=>[item.id,item.name] as [string,string])]} />
          <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={()=>{setType('todas');setSource('todas');setMotoboyFilter('todos')}} className="h-12 rounded-xl border border-zinc-800 text-xs font-black text-zinc-500">Limpar</button><button type="button" onClick={()=>setFiltersOpen(false)} className="h-12 rounded-xl bg-rose-500 text-xs font-black text-white">Aplicar</button></div>
        </section>
      </div>}

      <section className="space-y-4">
        {grouped.map(([key, items]) => (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[10px] font-black capitalize text-zinc-500">
                {dayLabel(key)}
              </p>
              <p className="text-[9px] font-bold text-zinc-700">
                {money(items.reduce((sum, item) => sum + item.amount, 0))}
              </p>
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const meta = META[item.type] || META.outro;
                const Icon = meta.Icon;

                return (
                  <article
                    key={item.id}
                    className={`rounded-[22px] border p-3.5 ${meta.tone}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${meta.iconTone}`}>
                        <Icon size={17} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-zinc-200">
                              {item.description}
                            </p>
                            <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-zinc-600">
                              {meta.label}
                              {item.motoboy_name ? ` · ${item.motoboy_name}` : ''}
                            </p>
                          </div>

                          <p className="shrink-0 text-sm font-black text-rose-300">
                            {money(item.amount)}
                          </p>
                        </div>

                        {item.observation && (
                          <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
                            {item.observation}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[9px] text-zinc-700">
                            {new Date(item.occurred_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {item.source_kind === 'motoboy_settlement'
                              ? ' · acerto'
                              : ' · manual'}
                          </p>

                          <div className="flex items-center gap-1">
                            {item.source_kind !== 'motoboy_settlement' && (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/despesas/editar?id=${encodeURIComponent(item.id)}`,
                                  )
                                }
                                className="grid h-8 w-8 place-items-center rounded-xl text-zinc-600 active:bg-zinc-800"
                                aria-label="Editar despesa"
                              >
                                <Pencil size={13} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setPendingDelete(item)}
                              className="grid h-8 w-8 place-items-center rounded-xl text-zinc-700 active:bg-red-500/10 active:text-red-400"
                              aria-label="Excluir despesa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        {!grouped.length && (
          <div className="dfl-empty">
            <ReceiptText size={34} className="mx-auto text-zinc-700" />
            <p className="mt-3 text-sm font-black text-zinc-300">
              Nenhuma despesa encontrada
            </p>
            <p className="mx-auto mt-1 max-w-[250px] text-[11px] leading-relaxed text-zinc-600">
              Compras de estoque e abastecimentos continuam nos módulos próprios
              para evitar dupla contagem.
            </p>
          </div>
        )}
      </section>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-black/75 p-3 backdrop-blur-sm"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <section
            className="dfl-bottom-sheet mx-auto w-full max-w-md p-5 pb-7"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-red-400">
              Excluir despesa
            </p>
            <h2 className="mt-2 font-heading text-lg font-black text-zinc-100">
              {pendingDelete.description}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Remove apenas este histórico operacional.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="h-12 rounded-xl border border-zinc-800 text-sm font-bold text-zinc-400"
              >
                Cancelar
              </button>
              <button
                disabled={deleting}
                onClick={confirmDelete}
                className="h-12 rounded-xl bg-red-500 text-sm font-black text-white"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="truncate text-[8px] font-black uppercase tracking-wide text-zinc-700">
        {label}
      </p>
      <p className="mt-1 truncate text-[11px] font-black text-zinc-300">
        {value}
      </p>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl border px-3.5 py-2 text-[10px] font-black ${
        active
          ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
          : 'border-zinc-800 bg-zinc-900/45 text-zinc-600'
      }`}
    >
      {label}
    </button>
  );
}

function ExpenseFilter({label,value,setValue,options}:{label:string;value:string;setValue:(value:string)=>void;options:[string,string][]}) {
  return <label className="mt-4 block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">{label}</span><select value={value} onChange={event=>setValue(event.target.value)} className="dfl-search px-3.5">{options.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>;
}
