'use client';

/** Apenas no Diagnóstico do admin: fixture simulada, nunca um pedido real. */
import fixture from '@/scripts/fixtures/r243-site-r249-certification-only.json';
import { inspectSiteComboV3Candidate } from '@/lib/integration/site-combo-v3-certification';
import { simulatedComboV3Receipt } from '@/lib/integration/site-combo-v3-thermal-preview';

const model = inspectSiteComboV3Candidate(fixture);
const preview58 = simulatedComboV3Receipt(model, 58);
const preview80 = simulatedComboV3Receipt(model, 80);
const money = (value: number) => (value / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});

export function ComboV3CertificationPanel() {
  return (
    <section aria-label="Laboratório Combo V3 — sem envio" className="mb-3 rounded-2xl border border-amber-500/25 bg-zinc-900/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.13em] text-amber-400">Gate E · R243 · somente demonstração</p>
          <h2 className="mt-1 text-sm font-bold text-zinc-50">Combo V3 por lanche</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">Dados fictícios. Receptor real, checkout, persistência, cobrança, envio e impressão continuam desativados.</p>
        </div>
        <span className="rounded-full border border-amber-500/25 px-2 py-1 text-[10px] font-bold text-amber-400">V3 OFF</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[['Combos', model.comboCount],['Unidades',model.unitCount],['Personalizadas',model.customizedUnitCount]].map(([label,count])=>(
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-2 py-3">
            <div className="text-base font-black tabular-nums text-zinc-100">{count}</div>
            <div className="text-[10px] text-zinc-500">{label}</div>
          </div>
        ))}
      </div>
      <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
        <summary className="cursor-pointer text-xs font-bold text-zinc-200">Conferir cada unidade, bebida e observações</summary>
        <div className="mt-3 space-y-2">
          {model.units.map(unit=>(
            <div key={unit.key} className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3">
              <div className="text-xs font-bold text-zinc-100">Combo {unit.comboNumber} · {unit.componentLabel} {unit.unitNumber}/{unit.groupQuantity}</div>
              <div className="mt-1 font-mono text-[10px] text-zinc-600">{unit.key}</div>
              {unit.addons.map(addon=><p key={addon.id} className="mt-1 text-xs text-emerald-400">+ {addon.label} · {money(addon.priceCents || 0)}</p>)}
              {unit.removals.map(removal=><p key={removal.id} className="mt-1 text-xs text-amber-400">SEM {removal.label}</p>)}
              {unit.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-300">OBS: {unit.note}</p>}
              {!unit.addons.length && !unit.removals.length && !unit.note && <p className="mt-1 text-xs text-zinc-500">Padrão, sem alterações</p>}
            </div>
          ))}
        </div>
      </details>
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
        <div className="flex justify-between gap-3"><span>Base simulada</span><span className="tabular-nums">{money(model.baseForOrderCents)}</span></div>
        <div className="mt-1 flex justify-between gap-3"><span>Adicionais simulados</span><span className="tabular-nums">{money(model.extrasForOrderCents)}</span></div>
        <div className="mt-2 flex justify-between gap-3 border-t border-zinc-800 pt-2 font-bold"><span>Total simulado</span><span className="tabular-nums">{money(model.totalCents)}</span></div>
      </div>
      {[{width:58,lines:preview58},{width:80,lines:preview80}].map(item=>(
        <details key={item.width} className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <summary className="cursor-pointer text-xs font-bold text-zinc-200">Prévia de bobina {item.width} mm · não imprimir</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre font-mono text-[10px] leading-5 text-zinc-300" aria-label={`Texto simulado ${item.width} mm`}>
            {item.lines.join('\n')}
          </pre>
        </details>
      ))}
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Os valores e produtos acima são sintéticos, para teste de apresentação. A compatibilidade do catálogo do Site, impressoras físicas e transações Firestore precisa de homologação separada.</p>
    </section>
  );
}
