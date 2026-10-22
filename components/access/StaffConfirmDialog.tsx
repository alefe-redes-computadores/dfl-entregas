'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, LockKeyhole, X } from 'lucide-react';
import { staffTouch } from '@/lib/access/staffTouch';

type Tone = 'safe' | 'caution' | 'danger';
export type StaffConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: Tone;
  busy?: boolean;
  requirePhrase?: string;
  detail?: string;
};
/** Dialogo nativo da experiencia DFL. Nenhum efeito executado no mount. */
export function StaffConfirmDialog({
  title, description, detail, confirmLabel, onConfirm, onCancel,
  tone = 'caution', busy = false, requirePhrase,
}: StaffConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [written, setWritten] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  const confirmable = !busy && (!requirePhrase || written.trim().toUpperCase() === requirePhrase);
  const Icon = tone === 'danger' ? AlertTriangle : tone === 'caution' ? LockKeyhole : CheckCircle2;
  const color = tone === 'danger' ? 'text-rose-300' : tone === 'caution' ? 'text-amber-300' : 'text-emerald-300';
  const fill = tone === 'danger' ? 'bg-rose-500/10 border-rose-500/25' : tone === 'caution' ? 'bg-amber-500/10 border-amber-500/25' : 'bg-emerald-500/10 border-emerald-500/25';
  const action = tone === 'danger' ? 'bg-rose-500 text-zinc-950' : tone === 'caution' ? 'bg-amber-400 text-zinc-950' : 'bg-emerald-400 text-zinc-950';
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-2 backdrop-blur-[4px] sm:items-center sm:p-5"
    onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}
      className="w-full max-w-md overflow-y-auto rounded-[28px] border border-zinc-700/80 bg-zinc-950 p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-zinc-100 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border ${fill} ${color}`}><Icon size={23}/></div>
        <button type="button" aria-label="Fechar confirmação" disabled={busy}
          onClick={() => { staffTouch(); onCancel(); }}
          className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-800 text-zinc-400 disabled:opacity-40"><X size={18}/></button>
      </div>
      <h2 id={titleId} className="mt-5 font-heading text-xl font-black tracking-tight">{title}</h2>
      <p id={descId} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-400">{description}</p>
      {detail && <p className="mt-4 break-words rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-xs font-medium leading-relaxed text-zinc-200">{detail}</p>}
      {requirePhrase && <label className="mt-5 block text-xs font-semibold text-zinc-300">
        Digite <strong className="text-amber-300">{requirePhrase}</strong> para confirmar
        <input value={written} onChange={event => setWritten(event.target.value)} autoComplete="off" spellCheck={false}
          placeholder={requirePhrase} aria-label={`Digite ${requirePhrase} para confirmar`}
          className="mt-2 h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus-visible:border-amber-400"/>
      </label>}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button type="button" ref={cancelRef} disabled={busy} onClick={() => { staffTouch(); onCancel(); }}
          className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-200 disabled:opacity-40">Voltar</button>
        <button type="button" disabled={!confirmable} onClick={() => { staffTouch(); onConfirm(); }}
          className={`min-h-12 rounded-xl px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-35 ${action}`}>
          {busy ? 'Aguarde...' : confirmLabel}
        </button>
      </div>
    </div>
  </div>;
}
