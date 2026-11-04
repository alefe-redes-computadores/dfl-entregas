'use client';
/** Laboratório offline de movimentação V3: sem entrada operacional e sem ações de envio. */
import fixture from '@/scripts/fixtures/r243-site-r249-certification-only.json';
import { inspectSiteComboV3Candidate } from '@/lib/integration/site-combo-v3-certification';
import { makeSiteV3Simulation, simulatedDispatchReceipt } from '@/lib/integration/site-combo-v3-dispatch-simulation';
const batch = makeSiteV3Simulation(inspectSiteComboV3Candidate(fixture));

export function ComboV3DispatchSimulationPanel() {
  return (
    <section aria-label="Conferência operacional simulada Combo V3" className="mb-3 rounded-2xl border border-cyan-500/20 bg-zinc-900/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-400">Gate E · R244 · ensaio operacional</p>
          <h2 className="mt-1 text-sm font-black text-zinc-100">Dois pedidos no mesmo endereço</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-400">Conferência de códigos, unidades e bobinas por pedido. Todos os dados são fictícios. Nenhuma ação é enviada.</p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300">NÃO OPERACIONAL</span>
      </div>
      <div className="mt-3 space-y-2">
        {batch.orders.map(order => (
          <details key={order.code} className="rounded-xl border border-zinc-800 bg-zinc-950/65 p-3">
            <summary className="cursor-pointer text-xs font-bold text-zinc-100">{order.code} · {order.customer} · {order.model.unitCount} unidades</summary>
            <p className="mt-2 break-words text-xs text-zinc-400">{order.address}</p>
            <p className="mt-1 text-[10px] text-amber-300">Mesma localização não mescla pedidos, preparos nem comprovantes.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([58,80] as const).map(width=>(
                <details key={width} className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-cyan-300">Bobina {width} mm · simulada</summary>
                  <pre aria-label={`Bobina simulada ${width} mm do ${order.code}`} className="mt-2 max-h-64 overflow-auto whitespace-pre font-mono text-[10px] leading-relaxed text-zinc-200">{simulatedDispatchReceipt(order,width).join('\n')}</pre>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
      <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/65 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-200">Prévia de conferência para o motoboy (sem envio)</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-300">{batch.driverPreview.join('\n')}</pre>
      </details>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Sem API, Firebase, impressão, compartilhamento ou cobrança. Para pedidos V3 reais, o Gate E ainda exige transação, integração assinada, testes físicos e aprovação explícita.</p>
    </section>
  );
}
