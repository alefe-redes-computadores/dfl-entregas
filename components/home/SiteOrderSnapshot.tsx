import type { Delivery } from '@/types';

function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export function SiteOrderSnapshot({ delivery, privacy = false }: { delivery: Delivery; privacy?: boolean }) {
  const snapshot = delivery.site_order_commercial;
  if (delivery.source_system !== 'dfl_site' || !snapshot) return null;
  const itemCount = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400/80">Pedido do site</p><p className="mt-0.5 text-xs font-bold text-zinc-200">{itemCount} {itemCount === 1 ? 'item' : 'itens'} · composição original</p></div>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[9px] font-black text-zinc-500">somente leitura</span>
      </div>
      <div className="mt-3 space-y-2">
        {snapshot.items.length ? snapshot.items.map((item, index) => (
          <div key={`${item.id || item.name}-${index}`} className="rounded-xl border border-zinc-800/70 bg-zinc-950/45 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3"><b className="text-xs leading-relaxed text-zinc-100">{item.quantity}x {item.name}</b>{!privacy && <span className="shrink-0 text-[10px] font-bold text-zinc-500">{money(item.line_total)}</span>}</div>
            {item.selected_addons.map((addon, addonIndex) => <p key={`${addon.id || addon.name}-${addonIndex}`} className="mt-1 text-[11px] font-semibold text-emerald-400/85">+ {addon.name}</p>)}
            {item.observation && <p className="mt-2 rounded-lg bg-amber-500/[0.08] px-2 py-1.5 text-[10px] font-semibold leading-relaxed text-amber-300">Obs.: {item.observation}</p>}
          </div>
        )) : <p className="text-[11px] text-zinc-500">O Site não enviou itens reconhecíveis neste registro.</p>}
      </div>
      {!privacy && <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-800/70 pt-3 text-[10px]">
        <span className="text-zinc-500">Subtotal</span><b className="text-right text-zinc-300">{money(snapshot.subtotal)}</b>
        {snapshot.delivery_fee > 0 && <><span className="text-zinc-500">Entrega</span><b className="text-right text-zinc-300">{money(snapshot.delivery_fee)}</b></>}
        {snapshot.discount > 0 && <><span className="text-zinc-500">Desconto{snapshot.coupon_code ? ` · ${snapshot.coupon_code}` : ''}</span><b className="text-right text-emerald-400">− {money(snapshot.discount)}</b></>}
        <span className="mt-1 font-black text-zinc-300">Total do Site</span><strong className="mt-1 text-right text-sm text-zinc-100">{money(snapshot.total)}</strong>
      </div>}
    </section>
  );
}
