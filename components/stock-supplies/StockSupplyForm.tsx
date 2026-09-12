// components/stock-supplies/StockSupplyForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Calculator, PackagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  PaymentMethod,
  StockSupply,
  StockSupplyItem,
  StockSupplyStatus,
  StockSupplyUnit,
} from '@/types';
import {
  SUPPLY_STATUS_LABELS,
  SUPPLY_UNIT_LABELS,
  supplyTotal,
} from '@/lib/stock-supply';
import {
  formatBRLCents,
  moneyToNumber,
  numberToBRLInput,
} from '@/lib/money-input';
import { feedbackError, feedbackSuccess } from '@/lib/ui-feedback';
import { TeamMemberPicker } from '@/components/team/TeamMemberPicker';
import { PurchaseDateTimePicker } from './PurchaseDateTimePicker';
import { StockSupplierPicker } from './StockSupplierPicker';
import { StockProductPicker } from './StockProductPicker';
import { useAppStore } from '@/store/useAppStore';
import { buildStockRecommendation } from '@/lib/stock-intelligence';
import { stockProductValue } from '@/lib/stock';
import { formatStockQuantity } from '@/lib/stock-quantity';

export type StockSupplyFormValue = Omit<
  StockSupply,
  'id' | 'created_at' | 'updated_at'
>;

type Draft = StockSupplyItem & {
  purchaseQty: string;
  purchasePrice: string;
  conversion: string;
  bundle?: boolean;
};

type ItemErrors = {
  product?: string;
  quantity?: string;
  conversion?: string;
};

const number = (value: string) => {
  const parsed = Number(
    value.trim().replace(/\./g, '').replace(',', '.'),
  );
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value?: number) =>
  value === undefined ? '' : String(value).replace('.', ',');

const fresh = (): Draft => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  quantity: 1,
  unit: 'un',
  purchaseQty: '1',
  purchasePrice: 'R$ 0,00',
  conversion: '1',
  purchase_unit: 'un',
});

const local = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const brl = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const field =
  'mt-2 h-14 w-full min-w-0 rounded-2xl border bg-zinc-900 px-4 text-base text-zinc-100 outline-none transition-colors';

const fieldClass = (invalid = false) =>
  `${field} ${
    invalid
      ? 'border-red-500/70 focus:border-red-500'
      : 'border-zinc-800 focus:border-amber-500'
  }`;

export function StockSupplyForm({
  initial,
  defaultBuyerName,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial?: StockSupply;
  defaultBuyerName?: string;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (value: StockSupplyFormValue) => Promise<void>;
}) {
  const products = useAppStore((state) =>
    state.stockProducts
      .filter((product) => product.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );
  const movements = useAppStore((state) => state.stockMovements);

  const [occurredAt, setOccurredAt] = useState(local(initial?.occurred_at));
  const [status, setStatus] = useState<StockSupplyStatus>(
    initial?.status || 'solicitado',
  );
  const [supplierId, setSupplierId] = useState(initial?.supplier_id || '');
  const [supplierText, setSupplierText] = useState(initial?.supplier || '');
  const [purchaserName, setPurchaserName] = useState(
    initial?.purchaser_name || defaultBuyerName || 'Álefe',
  );
  const [purchaserId, setPurchaserId] = useState(
    initial?.purchaser_id || '',
  );
  const [transport, setTransport] = useState(
    numberToBRLInput(initial?.transport_amount),
  );
  const [otherCosts, setOtherCosts] = useState(
    numberToBRLInput(initial?.other_costs),
  );
  const [payment, setPayment] = useState<PaymentMethod | ''>(
    initial?.payment_method || '',
  );
  const [observation, setObservation] = useState(initial?.observation || '');
  const [attempted, setAttempted] = useState(false);

  const [items, setItems] = useState<Draft[]>(
    initial?.items?.length
      ? initial.items.map((item) => {
          const purchaseQuantity =
            item.purchase_quantity ?? item.quantity;
          const price =
            item.purchase_unit_price ??
            (item.total_price && purchaseQuantity
              ? item.total_price / purchaseQuantity
              : item.unit_price);

          return {
            ...item,
            purchaseQty: text(purchaseQuantity),
            purchasePrice: numberToBRLInput(price),
            conversion: text(item.conversion_quantity ?? 1),
          };
        })
      : [fresh()],
  );

  const update = (id: string, data: Partial<Draft>) =>
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...data } : item)),
    );

  const chooseProduct = (id: string, value: string) => {
    const product = products.find((item) => item.id === value);
    const presentation = product?.presentations?.find(
      (item) => item.active,
    );

    update(id, {
      bundle: false,
      stock_product_id: product?.id,
      name: product?.name || '',
      unit: product?.unit || 'un',
      presentation_id: presentation?.id,
      presentation_label: presentation?.label,
      purchase_unit:
        presentation?.purchase_unit || product?.unit || 'un',
      conversion: text(presentation?.conversion_quantity ?? 1),
    });

    if (product) {
      if (typeof feedbackSuccess === 'function') void feedbackSuccess();
      toast.success(`${product.name} adicionado à compra.`);
    }
  };

  const addItem = () => {
    const item = fresh();
    setItems((value) => [item, ...value]);
    if (typeof feedbackSuccess === 'function') void feedbackSuccess();
    toast.info('Novo item adicionado no topo.');

    requestAnimationFrame(() => {
      document.getElementById(`purchase-item-${item.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const choosePresentation = (
    id: string,
    productId: string,
    presentationId: string,
  ) => {
    const presentation = products
      .find((product) => product.id === productId)
      ?.presentations?.find((item) => item.id === presentationId);

    if (presentation) {
      update(id, {
        presentation_id: presentation.id,
        presentation_label: presentation.label,
        purchase_unit: presentation.purchase_unit,
        conversion: text(presentation.conversion_quantity),
      });
    }
  };

  const chooseCustomMode = (
    id: string,
    mode: 'unit' | 'package',
  ) =>
    update(
      id,
      mode === 'unit'
        ? {
            purchase_unit: 'un',
            presentation_label: 'Unidade',
            conversion: '1',
          }
        : {
            purchase_unit: 'pct',
            presentation_label: 'Pacote personalizado',
            conversion: '1',
          },
    );

  const itemErrors = useMemo<Record<string, ItemErrors>>(() => {
    const errors: Record<string, ItemErrors> = {};

    for (const item of items) {
      const current: ItemErrors = {};
      const bought = number(item.purchaseQty);
      const factor = number(item.conversion);

      if (!item.name.trim()) {
        current.product =
          'Selecione um produto ou informe o nome do item.';
      }
      if (!(bought > 0)) {
        current.quantity = 'Informe uma quantidade maior que zero.';
      }
      if (!(factor > 0)) {
        current.conversion =
          'Informe quantas unidades entram no estoque.';
      }

      if (Object.keys(current).length) errors[item.id] = current;
    }

    return errors;
  }, [items]);

  const normalized = useMemo<StockSupplyItem[]>(
    () =>
      items
        .flatMap<StockSupplyItem>(
          ({
            purchaseQty,
            purchasePrice,
            conversion,
            bundle,
            ...item
          }) => {
            const bought = number(purchaseQty);
            const price = moneyToNumber(purchasePrice);
            const factor = Math.max(0, number(conversion));
            const total = Number((bought * price).toFixed(2));

            if (!bought || !factor) return [];

            const quantity = Number((bought * factor).toFixed(4));

            return [
              {
                ...item,
                name: item.name.trim(),
                quantity,
                unit_price: price
                  ? Number((total / quantity).toFixed(4))
                  : undefined,
                total_price: price ? total : undefined,
                purchase_quantity: bought,
                purchase_unit_price: price || undefined,
                conversion_quantity: factor,
              },
            ];
          },
        )
        .filter((item) => item.name && item.quantity > 0),
    [items],
  );

  const productsAmount = supplyTotal({
    items: normalized,
    total_amount: 0,
  });
  const freight = moneyToNumber(transport);
  const extras = moneyToNumber(otherCosts);
  const total = Number(
    (productsAmount + freight + extras).toFixed(2),
  );

  const hasErrors =
    !occurredAt || Object.keys(itemErrors).length > 0;

  const scrollToError = (id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);

    if (!occurredAt) {
      void feedbackError();
      scrollToError('purchase-date');
      return;
    }

    const firstInvalidItem = items.find(
      (item) => itemErrors[item.id],
    );

    if (firstInvalidItem) {
      void feedbackError();
      scrollToError(`purchase-item-${firstInvalidItem.id}`);
      return;
    }

    const now = new Date().toISOString();

    await onSubmit({
      occurred_at: new Date(occurredAt).toISOString(),
      status,
      items: normalized,
      products_amount: productsAmount,
      transport_amount: freight || undefined,
      other_costs: extras || undefined,
      total_amount: total,
      supplier_id: supplierId || undefined,
      supplier: supplierText.trim() || undefined,
      payment_method: payment || undefined,
      purchaser_id: purchaserId || undefined,
      purchaser_name: purchaserName.trim() || undefined,
      observation: observation.trim() || undefined,
      received_at:
        status === 'recebido' || status === 'conferido'
          ? initial?.received_at || now
          : undefined,
      checked_at:
        status === 'conferido'
          ? initial?.checked_at || now
          : undefined,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-10" noValidate>
      <section className="rounded-[26px] border border-amber-500/20 bg-amber-500/[.05] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
            <PackagePlus size={20} />
          </span>
          <div>
            <p className="font-heading text-sm font-black text-zinc-100">
              Compra para reposição
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">
              Campos com * são obrigatórios. O restante pode ser completado depois.
            </p>
          </div>
        </div>
      </section>

      <div id="purchase-date">
        <label className="text-xs font-bold text-zinc-400">
          Data e hora*
          <PurchaseDateTimePicker
            value={occurredAt}
            onChange={setOccurredAt}
          />
        </label>
        {attempted && !occurredAt && (
          <ErrorText>Informe a data e a hora da compra.</ErrorText>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-zinc-400">Situação</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SUPPLY_STATUS_LABELS).map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => setStatus(key as StockSupplyStatus)}
              className={`rounded-xl border px-3 py-3 text-xs font-bold ${
                status === key
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-zinc-400">
          Comprado por <span className="font-normal text-zinc-600">(opcional)</span>
        </p>
        <TeamMemberPicker
          value={purchaserId}
          onChange={(member) => {
            setPurchaserId(member.id);
            setPurchaserName(member.name);
          }}
        />
      </div>

      <label className="text-xs font-bold text-zinc-400">
        Fornecedor / local{' '}
        <span className="font-normal text-zinc-600">(opcional)</span>
        <StockSupplierPicker
          value={supplierId}
          text={supplierText}
          onChange={(id, name) => {
            setSupplierId(id);
            setSupplierText(name);
          }}
        />
      </label>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-zinc-200">
              Itens da compra*
            </p>
            <p className="text-[10px] text-zinc-600">
              Produto, quantidade e conversão precisam ser válidos.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex h-10 items-center gap-1 rounded-xl bg-amber-500/10 px-3 text-xs font-black text-amber-400"
          >
            <Plus size={14} />
            Item
          </button>
        </div>

        {items.map((item, index) => {
          const product = products.find(
            (current) => current.id === item.stock_product_id,
          );
          const errors = attempted ? itemErrors[item.id] : undefined;
          const base =
            number(item.purchaseQty) * number(item.conversion);
          const line =
            number(item.purchaseQty) *
            moneyToNumber(item.purchasePrice);
          const purchaseUnit =
            SUPPLY_UNIT_LABELS[item.purchase_unit || item.unit]
              .toLocaleLowerCase('pt-BR');

          return (
            <article
              id={`purchase-item-${item.id}`}
              key={item.id}
              className={`rounded-[24px] border bg-zinc-900/45 p-4 transition-colors ${
                errors
                  ? 'border-red-500/50'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className={`text-[10px] font-black uppercase ${
                      errors ? 'text-red-400' : 'text-zinc-600'
                    }`}
                  >
                    Item {index + 1}
                  </p>
                  {errors && (
                    <p className="mt-1 text-[9px] font-bold text-red-400">
                      Confira os campos destacados
                    </p>
                  )}
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setItems((value) =>
                        value.filter(
                          (current) => current.id !== item.id,
                        ),
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <label className="mt-3 block text-[10px] font-bold text-zinc-500">
                Produto*
                <StockProductPicker
                  products={products}
                  value={item.stock_product_id}
                  onChange={(value) =>
                    chooseProduct(item.id, value)
                  }
                  invalid={Boolean(errors?.product && item.stock_product_id)}
                />
              </label>

              {!item.stock_product_id && (
                <>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      update(item.id, { name: event.target.value })
                    }
                    placeholder="Nome do produto personalizado"
                    aria-invalid={Boolean(errors?.product)}
                    className={fieldClass(Boolean(errors?.product))}
                  />
                  {errors?.product && (
                    <ErrorText>{errors.product}</ErrorText>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        chooseCustomMode(item.id, 'unit')
                      }
                      className={`h-11 rounded-xl border text-xs font-bold ${
                        item.purchase_unit === 'un'
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                          : 'border-zinc-800 text-zinc-500'
                      }`}
                    >
                      Por unidade
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        chooseCustomMode(item.id, 'package')
                      }
                      className={`h-11 rounded-xl border text-xs font-bold ${
                        item.purchase_unit !== 'un'
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                          : 'border-zinc-800 text-zinc-500'
                      }`}
                    >
                      Pacote / caixa
                    </button>
                  </div>
                </>
              )}

              {product && (
                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3">
                  {(() => {
                    const recommendation =
                      buildStockRecommendation(
                        product,
                        movements,
                      );

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                          <span className="text-zinc-600">
                            Estoque atual
                            <b className="block text-zinc-300">
                              {formatStockQuantity(
                                product.current_quantity,
                                product.unit,
                              )}
                            </b>
                          </span>
                          <span className="text-zinc-600">
                            Valor em estoque
                            <b className="block text-emerald-400">
                              {brl(
                                stockProductValue(product),
                              )}
                            </b>
                          </span>
                          <span className="text-zinc-600">
                            Mínimo / meta
                            <b className="block text-zinc-300">
                              {formatStockQuantity(
                                product.minimum_quantity,
                                product.unit,
                              )}{' '}
                              /{' '}
                              {formatStockQuantity(
                                recommendation.targetQuantity,
                                product.unit,
                              )}
                            </b>
                          </span>
                          <span className="text-zinc-600">
                            Sugestão agora
                            <b className="block text-amber-400">
                              {formatStockQuantity(
                                recommendation.recommendedQuantity,
                                product.unit,
                              )}
                            </b>
                          </span>
                        </div>

                        <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">
                          {recommendation.explanation}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}

              {product && Boolean(product.presentations?.length) && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold text-zinc-500">
                    Como você comprou?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {product.presentations!
                      .filter((presentation) => presentation.active)
                      .map((presentation) => (
                        <button
                          type="button"
                          key={presentation.id}
                          onClick={() =>
                            choosePresentation(
                              item.id,
                              product.id,
                              presentation.id,
                            )
                          }
                          className={`min-h-11 rounded-xl border px-2 py-2 text-[10px] font-bold ${
                            item.presentation_id ===
                            presentation.id
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                              : 'border-zinc-800 text-zinc-500'
                          }`}
                        >
                          {presentation.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="min-w-0 text-[10px] font-bold text-zinc-500">
                  Quantos {purchaseUnit}s?*
                  <input
                    inputMode="decimal"
                    value={item.purchaseQty}
                    onChange={(event) =>
                      update(item.id, {
                        purchaseQty: event.target.value.replace(
                          /[^0-9.,]/g,
                          '',
                        ),
                      })
                    }
                    aria-invalid={Boolean(errors?.quantity)}
                    className={`${fieldClass(
                      Boolean(errors?.quantity),
                    )} mt-1`}
                  />
                  {errors?.quantity && (
                    <ErrorText>{errors.quantity}</ErrorText>
                  )}
                </label>

                <label className="min-w-0 text-[10px] font-bold text-zinc-500">
                  Preço por {purchaseUnit}{' '}
                  <span className="font-normal text-zinc-600">
                    (opcional)
                  </span>
                  <input
                    inputMode="numeric"
                    value={item.purchasePrice}
                    onChange={(event) =>
                      update(item.id, {
                        purchasePrice: formatBRLCents(
                          event.target.value,
                        ),
                      })
                    }
                    className={`${fieldClass()} mt-1`}
                  />
                </label>
              </div>

              {(!product || !product.presentations?.length) &&
                item.purchase_unit !== 'un' && (
                  <label className="mt-3 block text-[10px] font-bold text-zinc-500">
                    Unidades dentro de cada pacote*
                    <input
                      inputMode="decimal"
                      value={item.conversion}
                      onChange={(event) =>
                        update(item.id, {
                          conversion:
                            event.target.value.replace(
                              /[^0-9.,]/g,
                              '',
                            ),
                        })
                      }
                      aria-invalid={Boolean(errors?.conversion)}
                      className={`${fieldClass(
                        Boolean(errors?.conversion),
                      )} mt-1`}
                    />
                    {errors?.conversion && (
                      <ErrorText>{errors.conversion}</ErrorText>
                    )}
                  </label>
                )}

              <div className="mt-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[.04] p-3">
                <p className="flex items-center gap-2 text-[10px] font-black text-emerald-400">
                  <Calculator size={13} />
                  Resumo calculado
                </p>
                <p className="mt-1 text-xs font-bold text-zinc-200">
                  {item.purchaseQty || 0} {purchaseUnit}
                  {number(item.purchaseQty) === 1 ? '' : 's'} ={' '}
                  {base.toLocaleString('pt-BR')}{' '}
                  {SUPPLY_UNIT_LABELS[item.unit].toLocaleLowerCase(
                    'pt-BR',
                  )}
                </p>
                {line > 0 && base > 0 && (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Total {brl(line)} · custo real{' '}
                    {brl(line / base)} por{' '}
                    {SUPPLY_UNIT_LABELS[
                      item.unit
                    ].toLocaleLowerCase('pt-BR')}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label="Uber / frete"
          value={transport}
          set={setTransport}
        />
        <MoneyField
          label="Outros custos"
          value={otherCosts}
          set={setOtherCosts}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-zinc-400">
          Pagamento <span className="font-normal text-zinc-600">(opcional)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['', 'Não informado'],
              ['dinheiro', 'Dinheiro'],
              ['pix', 'Pix'],
              ['cartao', 'Cartão'],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={label}
              onClick={() => setPayment(key)}
              className={`h-11 rounded-xl border text-xs font-bold transition-colors ${
                payment === key
                  ? 'border-amber-500/60 bg-amber-500/12 text-amber-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.05] p-4">
        <p className="text-[10px] font-bold text-zinc-500">
          Produtos + transporte + outros
        </p>
        <p className="mt-2 font-heading text-2xl font-black text-emerald-400">
          {brl(total)}
        </p>
      </div>

      <label className="text-xs font-bold text-zinc-400">
        Observação{' '}
        <span className="font-normal text-zinc-600">(opcional)</span>
        <textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />
      </label>

      {attempted && hasErrors && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/[.06] p-3">
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0 text-red-400"
          />
          <p className="text-[10px] font-bold leading-relaxed text-red-300">
            Existem campos obrigatórios pendentes. Corrija os destaques em vermelho e tente novamente.
          </p>
        </div>
      )}

      <button
        disabled={busy}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-40"
      >
        <Save size={18} />
        {busy ? 'Registrando...' : submitLabel}
      </button>
    </form>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-red-400">
      <AlertCircle size={11} />
      {children}
    </span>
  );
}

function MoneyField({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
}) {
  return (
    <label className="min-w-0 text-xs font-bold text-zinc-400">
      {label}
      <input
        inputMode="numeric"
        value={value}
        onChange={(event) =>
          set(formatBRLCents(event.target.value))
        }
        className={fieldClass()}
      />
    </label>
  );
}
