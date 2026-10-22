'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CircleDollarSign, TrendingDown, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { stockLevel, stockValue } from '@/lib/stock';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { isOperationalStockConsumption } from '@/lib/stock-movement-authority';

const DAY = 86_400_000;
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function StockReports() {
  const allProducts = useAppStore((state) => state.stockProducts);
  const movements = useAppStore((state) => state.stockMovements);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [asOf, setAsOf] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(40);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setAsOf(Date.now()); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  const products = useMemo(() => allProducts.filter((product) => product.active), [allProducts]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const start = useMemo(() => asOf - days * DAY, [asOf, days]);
  const analytics = useMemo(() => {
    const usage = new Map<string, number>();
    const losses = new Map<string, number>();
    let lossValue = 0, entryValue = 0, consumptionEvents = 0;
    for (const movement of movements) {
      const occurredAt = new Date(movement.occurred_at).getTime();
      if (!Number.isFinite(occurredAt) || occurredAt < start) continue;
      const product = productMap.get(movement.product_id);
      if (movement.type === 'perda') {
        losses.set(movement.product_id, (losses.get(movement.product_id) || 0) + movement.quantity);
        lossValue += movement.quantity * (movement.unit_cost || product?.average_cost || 0);
      }
      if (movement.type === 'entrada') entryValue += movement.quantity * (movement.unit_cost || 0);
      if (isOperationalStockConsumption(movement)) {
        consumptionEvents += 1;
        usage.set(movement.product_id, (usage.get(movement.product_id) || 0) + movement.quantity);
      }
    }
    const ranking = products.map((product) => ({ product, usage: usage.get(product.id) || 0, loss: losses.get(product.id) || 0 }))
      .filter((row) => row.usage > 0 || row.loss > 0)
      .sort((a, b) => b.usage - a.usage || b.loss - a.loss || a.product.name.localeCompare(b.product.name, 'pt-BR'));
    return { ranking, lossValue, entryValue, consumptionEvents };
  }, [movements, productMap, products, start]);
  const stockTotal = useMemo(() => stockValue(products), [products]);
  const displayedRanking = useMemo(() => analytics.ranking.slice(0, visibleCount), [analytics.ranking, visibleCount]);
  const low = useMemo(() => products.filter((product) => stockLevel(product) !== 'ok'), [products]);
  const diagnostics = useMemo(() => products.filter((product) =>
    product.minimum_quantity === (product.ideal_quantity ?? product.minimum_quantity) || (product.average_cost ?? 0) <= 0 ||
    (product.presentations || []).some((presentation) => presentation.active && presentation.conversion_quantity <= 0)), [products]);

  return <div className="pb-28"><PageHeader title="Inteligência de estoque" subtitle="Consumo operacional, perdas e qualidade do cadastro" to="/estoque" />
    <div className="mb-4 grid grid-cols-3 gap-2">{([7, 30, 90] as const).map((value) => <button key={value} onClick={() => setDays(value)} className={`h-11 rounded-xl border text-xs font-black ${days === value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{value} dias</button>)}</div>
    <section className="grid grid-cols-2 gap-3"><Card icon={Wallet} label="Valor em estoque" value={money(stockTotal)}/><Card icon={TrendingDown} label="Perdas estimadas" value={money(analytics.lossValue)} alert={analytics.lossValue > 0}/><Card icon={BarChart3} label="Entradas no período" value={money(analytics.entryValue)}/><Card icon={AlertTriangle} label="Reposição necessária" value={String(low.length)} alert={low.length > 0}/></section>
    <section className="mt-5 rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4"><p className="text-[10px] font-black uppercase text-emerald-400">Leitura automática · {days} dias</p><h2 className="mt-2 font-heading text-lg font-black text-zinc-100">{low.length ? `${low.length} produto${low.length === 1 ? '' : 's'} precisa${low.length === 1 ? '' : 'm'} de atenção` : 'Estoque dentro dos limites cadastrados'}</h2><p className="mt-2 text-xs leading-relaxed text-zinc-500">{analytics.consumptionEvents >= 3 ? `Confiança ${analytics.consumptionEvents >= 20 ? 'alta' : analytics.consumptionEvents >= 8 ? 'média' : 'inicial'}: ${analytics.consumptionEvents} saídas operacionais válidas. Estornos, contagens e correções não inflam o consumo.` : 'Amostra insuficiente: registre pelo menos 3 saídas operacionais para iniciar comparações. Nenhum dado artificial é usado.'}</p>{diagnostics.length > 0 && <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-3"><CircleDollarSign size={16} className="mt-0.5 shrink-0 text-amber-400"/><p className="text-[11px] font-bold leading-relaxed text-amber-100">{diagnostics.length} cadastro{diagnostics.length === 1 ? '' : 's'} merece{diagnostics.length === 1 ? '' : 'm'} revisão de custo, meta ou apresentação.</p></div>}</section>
    <section className="mt-5"><h2 className="mb-3 font-heading font-black text-zinc-100">Consumo por produto</h2><div className="space-y-2">{displayedRanking.map(({ product, usage, loss }) => <article key={product.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"><div className="flex justify-between gap-3"><p className="truncate font-black text-zinc-200">{product.name}</p><p className="shrink-0 text-xs font-black text-emerald-400">{formatStockQuantity(usage, product.unit)} saíram</p></div>{loss > 0 && <p className="mt-2 text-[10px] font-bold text-red-400">{formatStockQuantity(loss, product.unit)} registrados como perda</p>}</article>)}{displayedRanking.length < analytics.ranking.length && <button type="button" onClick={() => setVisibleCount((count) => count + 40)} className="w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">Mostrar mais 40 · {analytics.ranking.length - displayedRanking.length} restantes</button>}{analytics.ranking.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-xs text-zinc-600">Sem consumo operacional neste período.</p>}</div></section>
  </div>;
}
function Card({ icon: Icon, label, value, alert }: { icon: typeof Wallet; label: string; value: string; alert?: boolean }) { return <div className={`min-w-0 rounded-[22px] border p-4 ${alert ? 'border-amber-500/25 bg-amber-500/[.05]' : 'border-zinc-800 bg-zinc-900/45'}`}><Icon size={16} className={alert ? 'text-amber-400' : 'text-emerald-400'}/><p className="mt-3 truncate font-heading text-lg font-black text-zinc-100">{value}</p><p className="mt-1 text-[10px] font-bold text-zinc-600">{label}</p></div>; }
