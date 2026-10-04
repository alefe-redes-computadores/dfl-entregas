// app/estoque/movimentar/page.tsx
'use client';

import { commercialMovementPreview, commercialPresentationEquation, humanPresentation } from '@/lib/stock-commercial-display-v2';
import { committedStockQuantityMap } from '@/lib/stock-shopping';

import {
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  AlertCircle,
  Calculator,
  PackageOpen,
  ShoppingCart,
  Save,
  SkipForward,
} from 'lucide-react';

import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';

import { TeamMemberPicker } from '@/components/team/TeamMemberPicker';

import {
  formatBRLCents,
  moneyToNumber,
} from '@/lib/money-input';

import {
  feedbackError,
  feedbackSuccess,
} from '@/lib/ui-feedback';

import {
  formatStockQuantity,
  normalizeStockQuantityInput,
  parseStockQuantityInput,
  quantityInputHint,
} from '@/lib/stock-quantity';

import { useAppStore } from '@/store/useAppStore';
import { notifyStockThresholdChanges } from '@/lib/native/notifications';

import type {
  StockMovementType,
} from '@/types';

const options: Array<
  [StockMovementType, string, string]
> = [
  [
    'entrada',
    'Entrada',
    'Compra ou reposição',
  ],
  [
    'saida',
    'Saída',
    'Uso normal da operação',
  ],
  [
    'perda',
    'Perda',
    'Descarte, vencimento ou avaria',
  ],
  [
    'contagem',
    'Contagem',
    'Substitui o saldo pela contagem real',
  ],
  [
    'ajuste',
    'Ajuste',
    'Define manualmente um novo saldo',
  ],
];

const quantityLabels: Record<string, string> = {
  un: 'unidades',
  g: 'gramas',
  kg: 'quilos',
  ml: 'mililitros',
  l: 'litros',
  cx: 'caixas',
  pct: 'pacotes',
  fardo: 'fardos',
};
const quantityLabel = (unit: string) => quantityLabels[unit] || unit;

function Content() {
  const router = useRouter();

  const search = useSearchParams();

  const id = search.get('id');
  const from = search.get('from');

  const product = useAppStore(
    (state) =>
      state.stockProducts.find(
        (item) => item.id === id,
      ),
  );

  const add = useAppStore(
    (state) =>
      state.addStockMovement,
  );

  const activeProducts = useAppStore((state) => state.stockProducts.filter((item) => item.active));
  const stockSupplies = useAppStore((state) => state.stockSupplies);

  const [type, setType] =
    useState<StockMovementType>(
      'saida',
    );

  const [quantity, setQuantity] = useState('');

  const [presentationId, setPresentationId] = useState('base');
  const presentations = (product?.presentations || []).filter((item) => item.active && Number(item.conversion_quantity) > 0);
  const selectedPresentation = presentations.find((item) => item.id === presentationId);
  const conversion = selectedPresentation ? Number(selectedPresentation.conversion_quantity) : 1;

  const [mode, setMode] =
    useState<
      'moved' | 'remaining'
    >('moved');

  const [cost, setCost] =
    useState('R$ 0,00');

  const [reason, setReason] =
    useState('');

  const [memberId, setMemberId] =
    useState('');

  const [memberName, setMemberName] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const savingRef = useRef(false);

  const [submitIntent, setSubmitIntent] =
    useState<'return' | 'next'>('return');

  const [attempted, setAttempted] =
    useState(false);

  useEffect(() => {
    savingRef.current = false;
    setBusy(false);
    setSubmitIntent('return');
    setType('saida');
    setMode('moved');
    setQuantity('');
    setPresentationId('base');
    setCost('R$ 0,00');
    setReason('');
    setAttempted(false);
  }, [product?.id]);

  if (!product) {
    return (
      <PageHeader
        title="Produto não encontrado"
        to="/estoque"
      />
    );
  }

  const typed =
    parseStockQuantityInput(
      quantity,
    );

  const canUseRemaining =
    type === 'saida' ||
    type === 'perda';

  const baseTyped = Number((typed * conversion).toFixed(4));
  const amount = canUseRemaining && mode === 'remaining'
    ? Number(Math.max(0, product.current_quantity - baseTyped).toFixed(4))
    : baseTyped;

  const resultingBalance =
    type === 'entrada'
      ? product.current_quantity +
        amount
      : type === 'saida' ||
          type === 'perda'
        ? product.current_quantity -
          amount
        : amount;

  const allowsZero =
    type === 'contagem' ||
    type === 'ajuste';

  const remainingInvalid =
    canUseRemaining &&
    mode === 'remaining' &&
    (typed < 0 ||
      typed >
        product.current_quantity);

  const insufficientStock =
    (type === 'saida' || type === 'perda') &&
    mode === 'moved' &&
    amount > product.current_quantity;

  const pendingSupply = stockSupplies.find((supply) =>
    !supply.stock_integrated_at &&
    !supply.stock_reversed_at &&
    supply.items.some((item) => item.stock_product_id === product.id),
  );
  const committedQuantity = committedStockQuantityMap(stockSupplies).get(product.id) || 0;
  const pendingSupplyQuantity = pendingSupply?.items
    .filter((item) => item.stock_product_id === product.id)
    .reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0) || committedQuantity;

  const quantityInvalid =
    !quantity.trim() ||
    !Number.isFinite(typed) ||
    typed < 0 ||
    remainingInvalid ||
    (!allowsZero &&
      mode === 'moved' &&
      amount <= 0) ||
    (canUseRemaining &&
      mode === 'remaining' &&
      amount <= 0) ||
    ((type === 'saida' ||
      type === 'perda') &&
      amount >
        product.current_quantity);

  const submit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (quantityInvalid) {
      setAttempted(true);
      void feedbackError();

      document
        .getElementById(
          'stock-movement-quantity',
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

      return;
    }

    setAttempted(false);

    if (savingRef.current) return;

    savingRef.current = true;
    setBusy(true);

    try {
      const operation = add({
        id: `move-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,

        product_id: product.id,

        product_name:
          product.name,

        type,

        quantity: amount,

        unit_cost:
          type === 'entrada' &&
          moneyToNumber(cost) > 0
            ? moneyToNumber(cost)
            : undefined,

        reason:
          (canUseRemaining &&
          mode === 'remaining'
            ? `Saldo informado: ${formatStockQuantity(
                typed,
                product.unit,
              )}${
                reason.trim()
                  ? ` · ${reason.trim()}`
                  : ''
              }`
            : reason.trim()) ||
          undefined,

        team_member_id:
          memberId || undefined,

        team_member_name: memberName || useAppStore.getState().user?.displayName || undefined,
        team_member_photo_url: useAppStore.getState().user?.photoURL || undefined,
        presentation_id: selectedPresentation?.id,
        presentation_label: selectedPresentation?.label,
        presentation_quantity: typed,
        presentation_unit: selectedPresentation?.purchase_unit || product.unit,
        conversion_quantity: conversion,

        occurred_at:
          new Date().toISOString(),
      });

      toast.loading(
        'Salvando movimentação...',
        {
          id: 'stock-movement-save',
        },
      );

      await operation;

      void feedbackSuccess();

      toast.success(
        'Movimentação registrada.',
        {
          id: 'stock-movement-save',
        },
      );

      sessionStorage.setItem(
        'dfl-stock-anchor',
        product.id,
      );

      if (submitIntent === 'next') {
        const queue = (()=>{ try { return JSON.parse(sessionStorage.getItem('dfl-stock-review-queue') || '[]') as string[]; } catch { return []; } })();
        const ordered = queue.length ? queue.map((pid)=>activeProducts.find((item)=>item.id===pid)).filter(Boolean) : activeProducts;
        const index = ordered.findIndex((item)=>item?.id===product.id);
        const next = index >= 0 ? ordered[index + 1] : undefined;

        if (next) {
          sessionStorage.setItem(
            'dfl-stock-anchor',
            next.id,
          );
          router.replace(
            `/estoque/movimentar?id=${next.id}&from=estoque`,
          );
          return;
        }

        try {
          const changes = JSON.parse(sessionStorage.getItem('dfl-stock-review-changes') || '[]');
          if (changes.length) await notifyStockThresholdChanges(changes, useAppStore.getState().storeSettings.notificationPreferences);
        } catch {}
        sessionStorage.removeItem('dfl-stock-review-changes');
        sessionStorage.removeItem('dfl-stock-review-queue');
        toast.success('Conferência concluída.', { description: 'Alertas de estoque agrupados em um único resumo.' });
      }

      if (from === 'estoque') {
        router.replace('/estoque');
      } else {
        router.replace(
          `/estoque/detalhes?id=${product.id}`,
        );
      }
    } catch (error) {
      console.error(
        'Erro ao movimentar estoque:',
        error,
      );

      void feedbackError();

      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o estoque.',
        {
          id: 'stock-movement-save',
        },
      );
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Movimentar estoque"
        subtitle="Registro operacional"
        to={
          from === 'estoque'
            ? '/estoque'
            : `/estoque/detalhes?id=${product.id}`
        }
      />

      <section className="relative mb-5 overflow-hidden rounded-[26px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.11] via-zinc-950 to-zinc-950 p-4 shadow-[0_18px_60px_rgba(16,185,129,.07)]">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <PackageOpen size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">
              Movimentando agora
            </p>
            <h1 className="mt-1 break-words font-heading text-xl font-black leading-tight text-zinc-50">
              {product.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold">
              {product.category && (
                <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-zinc-400">
                  {product.category}
                </span>
              )}
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-300">
                Unidade interna · {product.unit}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-4 flex items-end justify-between gap-3 border-t border-white/[.06] pt-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Saldo atual</p>
            <p className="mt-1 font-heading text-3xl font-black text-zinc-100">
              {formatStockQuantity(product.current_quantity, product.unit)}
            </p>
          </div>
          <p className="max-w-[46%] text-right text-[9px] leading-relaxed text-zinc-600">
            Confira o produto antes de registrar a movimentação.
          </p>
        </div>
      </section>

      <form
        onSubmit={submit}
        className="space-y-5 pb-28"
        noValidate
      >
        <div className="grid grid-cols-2 gap-2">
          {options.map(
            ([
              key,
              label,
              description,
            ]) => (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setType(key);
                  setMode('moved');
                  setQuantity('');
                  setAttempted(
                    false,
                  );
                }}
                className={`min-h-16 rounded-2xl border p-3 text-left ${
                  type === key
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <b
                  className={
                    type === key
                      ? 'text-emerald-400'
                      : 'text-zinc-300'
                  }
                >
                  {label}
                </b>

                <small className="mt-1 block text-[9px] text-zinc-600">
                  {description}
                </small>
              </button>
            ),
          )}
        </div>

        {canUseRemaining && (
          <div>
            <p className="mb-2 text-xs font-bold text-zinc-400">
              Como quer informar?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('moved');
                  setQuantity('');
                  setAttempted(
                    false,
                  );
                }}
                className={`h-12 rounded-xl border text-xs font-black ${
                  mode === 'moved'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 text-zinc-500'
                }`}
              >
                Quanto saiu
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(
                    'remaining',
                  );
                  setQuantity('');
                  setAttempted(
                    false,
                  );
                }}
                className={`h-12 rounded-xl border text-xs font-black ${
                  mode ===
                  'remaining'
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                    : 'border-zinc-800 text-zinc-500'
                }`}
              >
                Quanto sobrou
              </button>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Como você vai informar?</p><p className="mt-1 text-[9px] text-zinc-600">Escolha a unidade usada na digitação.</p></div>{(()=>{try{const q=JSON.parse(sessionStorage.getItem('dfl-stock-review-queue')||'[]') as string[];const i=q.indexOf(product.id);return q.length&&i>=0?<span className="text-[10px] font-black text-sky-400">{i+1}/{q.length}</span>:null}catch{return null}})()}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>{setPresentationId('base');setQuantity('');setAttempted(false)}} className={`rounded-xl border p-3 text-left text-xs font-black ${presentationId==='base'?'border-sky-500/40 bg-sky-500/10 text-sky-300':'border-zinc-800 text-zinc-500'}`}>Direto em {quantityLabel(product.unit)}<span className="mt-1 block text-[9px] font-medium">Unidade controlada no estoque</span></button>
            {presentations.map((item)=><button type="button" key={item.id} onClick={()=>{setPresentationId(item.id);setQuantity('');setAttempted(false)}} className={`rounded-xl border p-3 text-left text-xs font-black ${presentationId===item.id?'border-amber-500/40 bg-amber-500/10 text-amber-300':'border-zinc-800 text-zinc-500'}`}>{humanPresentation(item,product.unit)}<span className="mt-1 block text-[9px] font-medium">{Math.abs(Number(item.conversion_quantity)-1)<1e-9?`Formato de compra · mesma quantidade`:commercialPresentationEquation(item,product.unit)}</span></button>)}
          </div>
        </section>

        <label
          id="stock-movement-quantity"
          className="block text-xs font-bold text-zinc-400"
        >
          {canUseRemaining &&
          mode === 'remaining'
            ? 'Saldo que sobrou*'
            : type ===
                  'contagem' ||
                type === 'ajuste'
              ? 'Novo saldo*'
              : selectedPresentation
                ? `Quantidade de ${quantityLabel(selectedPresentation.purchase_unit)}*`
                : `Quantidade em ${quantityLabel(product.unit)}*`}

          <span className="mt-1 block text-[9px] font-normal text-zinc-600">
            {quantityInputHint(
              product.unit,
            )}
          </span>

          <input
            autoFocus
            inputMode="decimal"
            value={quantity}
            onChange={(event) =>
              setQuantity(
                event.target.value.replace(
                  /[^0-9.,]/g,
                  '',
                ),
              )
            }
            onBlur={() =>
              quantity.trim() &&
              setQuantity(
                normalizeStockQuantityInput(
                  quantity,
                ),
              )
            }
            aria-invalid={
              attempted &&
              quantityInvalid
            }
            className={`mt-2 h-14 w-full rounded-2xl border bg-zinc-900 px-4 text-xl font-black text-zinc-100 outline-none ${
              attempted &&
              quantityInvalid
                ? 'border-red-500/70 focus:border-red-500'
                : 'border-zinc-800 focus:border-emerald-500'
            }`}
            placeholder="0"
          />

          {attempted &&
            quantityInvalid && (
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-400">
                <AlertCircle
                  size={12}
                />

                {remainingInvalid
                  ? 'O saldo restante não pode ser maior que o saldo atual.'
                  : insufficientStock
                    ? `Saldo insuficiente: disponível ${formatStockQuantity(product.current_quantity, product.unit)}.`
                  : 'Informe uma quantidade válida.'}
              </span>
            )}
        </label>

        {quantity.trim() && insufficientStock && (
          <section className="rounded-2xl border border-red-500/25 bg-red-500/[.055] p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-red-400">
              <AlertCircle size={14} /> Saldo insuficiente
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">
              Você tentou retirar <b>{formatStockQuantity(amount, product.unit)}</b>, mas existem somente <b>{formatStockQuantity(product.current_quantity, product.unit)}</b> disponíveis.
            </p>
            {pendingSupply && pendingSupplyQuantity > 0 && (
              <button type="button" onClick={()=>router.push(`/abastecimentos/detalhes?id=${pendingSupply.id}`)} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[.07] p-3 text-left active:scale-[.99]">
                <ShoppingCart size={17} className="shrink-0 text-amber-400" />
                <span className="min-w-0 flex-1">
                  <b className="block text-[10px] text-amber-300">Há {formatStockQuantity(pendingSupplyQuantity, product.unit)} em compra ainda não lançada</b>
                  <small className="mt-0.5 block text-[9px] leading-relaxed text-zinc-500">Abra a compra, confirme o recebimento e lance no estoque antes de retirar.</small>
                </span>
              </button>
            )}
          </section>
        )}

        {quantity.trim() &&
          !quantityInvalid && (
            <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[.05] p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-sky-400">
                <Calculator
                  size={14}
                />
                Saldo após esta movimentação
              </p>

              {selectedPresentation && (
                <p className="mt-2 text-[10px] font-bold text-sky-200">
                  {commercialMovementPreview(selectedPresentation,product.unit,typed)}
                </p>
              )}

              {canUseRemaining &&
                mode ===
                  'remaining' && (
                  <p className="mt-2 text-sm font-black text-zinc-100">
                    Saída calculada:{' '}
                    {formatStockQuantity(
                      amount,
                      product.unit,
                    )}
                  </p>
                )}

              <p className="mt-1 text-xs text-zinc-500">
                {formatStockQuantity(
                  product.current_quantity,
                  product.unit,
                )}
                {' → '}
                <b className="text-zinc-200">
                  {formatStockQuantity(
                    Math.max(
                      0,
                      resultingBalance,
                    ),
                    product.unit,
                  )}
                </b>
              </p>
            </section>
          )}

        {type ===
          'entrada' && (
          <label className="block text-xs font-bold text-zinc-400">
            Custo por{' '}
            {product.unit === 'kg'
              ? 'quilo'
              : product.unit ===
                  'l'
                ? 'litro'
                : product.unit ===
                    'un'
                  ? 'unidade'
                  : product.unit}{' '}

            <span className="font-normal text-zinc-600">
              (opcional)
            </span>

            <input
              inputMode="numeric"
              value={cost}
              onChange={(event) =>
                setCost(
                  formatBRLCents(
                    event.target
                      .value,
                  ),
                )
              }
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-base font-bold text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        )}

        <div>
          <p className="mb-2 text-xs font-bold text-zinc-400">
            Responsável{' '}
            <span className="font-normal text-zinc-600">
              (opcional)
            </span>
          </p>

          <TeamMemberPicker
            value={memberId}
            onChange={(
              member,
            ) => {
              setMemberId(
                member.id,
              );

              setMemberName(
                member.name,
              );
            }}
          />
        </div>

        <label className="block text-xs font-bold text-zinc-400">
          Motivo / observação{' '}
          <span className="font-normal text-zinc-600">
            (opcional)
          </span>

          <textarea
            value={reason}
            onChange={(event) =>
              setReason(
                event.target.value,
              )
            }
            rows={3}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 outline-none focus:border-emerald-500"
          />
        </label>

        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <button
            type="submit"
            disabled={busy}
            onClick={() =>
              setSubmitIntent('return')
            }
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 active:scale-[.99] disabled:opacity-40"
          >
            <Save size={18} />
            {busy &&
            submitIntent === 'return'
              ? 'Salvando...'
              : from === 'estoque'
                ? 'Salvar e voltar'
                : 'Confirmar'}
          </button>

          {from === 'estoque' && (
            <button
              type="submit"
              disabled={busy}
              onClick={() =>
                setSubmitIntent('next')
              }
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 font-black text-sky-300 active:scale-[.99] disabled:opacity-40"
            >
              <SkipForward size={18} />
              {busy &&
              submitIntent === 'next'
                ? 'Salvando...'
                : 'Salvar e próximo'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function StockMovementPage() {
  return (
    <Suspense
      fallback={
        <p className="py-20 text-center text-zinc-500">
          Carregando...
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
