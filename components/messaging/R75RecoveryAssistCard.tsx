'use client';
/** R75 P2: protected operator assistance; copies generic text only after two confirmations. */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { R75AuditView } from '@/lib/integration/messagingAuditPolicyR75';
import { r75RecoveryReview, r75RecoveryReason, type RecoveryDelivery } from '@/lib/integration/r75RecoveryPolicy';

type Props = {
  audit: R75AuditView;
  delivery?: RecoveryDelivery;
  selectedDeliveryId: string;
  auditedDeliveryId: string;
};
export function R75RecoveryAssistCard({audit,delivery,selectedDeliveryId,auditedDeliveryId}:Props) {
  const [selected, setSelected] = useState('');
  const [customerChecked, setCustomerChecked] = useState(false);
  const [uncertaintyAcknowledged, setUncertaintyAcknowledged] = useState(false);
  const [copied, setCopied] = useState<Record<string,boolean>>({});
  const [error, setError] = useState('');
  const review = r75RecoveryReview(audit, delivery, selectedDeliveryId, auditedDeliveryId);
  const choice = review.allowed ? review.cases.find(c=>c.fingerprint === selected) : undefined;
  const pick = (fingerprint:string) => {
    setSelected(fingerprint);setCustomerChecked(false);setUncertaintyAcknowledged(false);setError('');
  };
  const copy = async () => {
    if (!choice || !customerChecked || !uncertaintyAcknowledged || copied[choice.fingerprint]) return;
    // Recheck the time-sensitive audit on user gesture; do not rely on earlier render state.
    const again = r75RecoveryReview(audit,delivery,selectedDeliveryId,auditedDeliveryId);
    if (!again.allowed || !again.cases.some(c=>c.fingerprint===choice.fingerprint)) {
      setError('A auditoria expirou ou mudou. Atualize o panorama.');return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(choice.text);
      setCopied(v=>({...v,[choice.fingerprint]:true}));
      setError('');
    } catch { setError('Não foi possível copiar. Nenhuma mensagem foi enviada.'); }
  };
  return <section aria-label="Recuperação assistida de avisos" className="rounded-2xl border border-amber-400/20 bg-zinc-950/85 p-3.5">
    <div className="flex items-start gap-2"><ShieldCheck className="shrink-0 text-amber-300" size={17}/><div>
      <h3 className="text-xs font-black text-zinc-100">Recuperação individual · assistida</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Sem reenvio do bot. Revisão humana, sem novo link e sem modificar a fila.</p>
    </div></div>
    {!review.allowed ? <p className="mt-3 flex gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 text-[11px] text-zinc-300"><LockKeyhole size={16} className="shrink-0 text-zinc-400"/>{r75RecoveryReason[review.reason]}</p> : <>
      <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-amber-200"><AlertTriangle size={16} className="shrink-0"/>O provedor pode ter aceitado o aviso antigo. Confirme com o cliente antes de fazer contato manual.</p>
      <div className="mt-3 space-y-2">{review.cases.map(item=><button type="button" key={item.fingerprint} disabled={Boolean(copied[item.fingerprint])} onClick={()=>pick(item.fingerprint)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-xs ${selected===item.fingerprint?'border-amber-400/70 bg-amber-400/10 text-amber-100':'border-zinc-700 bg-zinc-900/70 text-zinc-200'} disabled:opacity-50`}>
        <span>{item.title} · {item.state==='dead_letter'?'Revisão':'Falhou'}</span>{copied[item.fingerprint]?<CheckCircle2 size={16}/>:<span>Selecionar</span>}
      </button>)}</div>
      {choice && !copied[choice.fingerprint] && <div className="mt-3 space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/65 p-3">
        <p className="text-[11px] text-zinc-300">O texto é neutro e não afirma que o pedido está pronto, na rota ou que um link ainda é válido.</p>
        <label className="flex items-start gap-2 text-[11px] text-zinc-200"><input type="checkbox" checked={customerChecked} onChange={(e:{target:{checked:boolean}})=>setCustomerChecked(e.target.checked)} className="mt-0.5 accent-amber-400"/>Conferi a situação atual e o contato com o cliente fora desta auditoria.</label>
        <label className="flex items-start gap-2 text-[11px] text-zinc-200"><input type="checkbox" checked={uncertaintyAcknowledged} onChange={(e:{target:{checked:boolean}})=>setUncertaintyAcknowledged(e.target.checked)} className="mt-0.5 accent-amber-400"/>Entendo que o aviso anterior pode ter sido entregue; esta ação apenas copia uma nova mensagem.</label>
        <button type="button" disabled={!customerChecked||!uncertaintyAcknowledged} onClick={()=>void copy()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-xs font-black text-zinc-950 disabled:opacity-50"><ClipboardCopy size={16}/>Copiar texto para contato manual</button>
      </div>}
      {choice && copied[choice.fingerprint] && <p role="status" className="mt-3 text-[11px] text-emerald-300">Texto copiado. Nenhum WhatsApp foi enviado automaticamente.</p>}
    </>}
    {error && <p role="alert" className="mt-2 text-[11px] text-rose-300">{error}</p>}
    <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Não inclui telefone, endereço, token ou URL. A cópia não prova entrega e não marca a outbox como enviada. Links privados exigem nova autorização e um fluxo separado.</p>
  </section>;
}
