'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardCopy, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { toast } from '@/lib/operational-toast';
import { RELEASE_CHECKS, assessReleaseReadiness, releaseChecklistText, type ReleaseCheckId } from '@/lib/access/release-readiness';

/** R204: lembretes de homologacao em memoria; nenhuma consulta Firebase ou ativacao de acesso. */
export default function ReleaseReadinessPage() {
  const router = useRouter();
  const uid = useAppStore(state => state.user?.uid);
  const [checked, setChecked] = useState<ReleaseCheckId[]>([]);
  const summary = useMemo(() => assessReleaseReadiness(checked, 'pendente'), [checked]);
  const isOwner = isSuperadminUid(uid);
  const toggle = (id: ReleaseCheckId) => setChecked(items =>
    items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(releaseChecklistText(checked, 'pendente'));
      toast.success('Checklist copiado. Ele nao e comprovante de homologacao.');
    } catch { toast.error('Nao foi possivel copiar o checklist.'); }
  };

  if (!isOwner) return <div className="dfl-page p-5"><div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5 text-center"><LockKeyhole className="mx-auto text-rose-400"/><h1 className="mt-2 font-black">Acesso restrito</h1><p className="mt-2 text-xs text-zinc-400">Somente o superadministrador pode consultar esta central.</p></div></div>;

  return <main className="dfl-page space-y-4 pb-28">
    <header className="flex items-center gap-3"><button type="button" onClick={()=>router.push('/mais/acessos')} aria-label="Voltar para equipe" className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-800 bg-zinc-900"><ArrowLeft size={19}/></button><div><p className="text-[10px] font-black uppercase tracking-widest text-sky-400">Operacao segura</p><h1 className="font-heading text-xl font-black">Homologacao de producao</h1></div></header>
    <section className="rounded-3xl border border-amber-500/25 bg-amber-500/[.055] p-4">
      <div className="flex items-center gap-2"><ShieldAlert className="text-amber-400" size={20}/><h2 className="text-sm font-black text-amber-100">Publicacao pendente</h2></div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-300">Regras Firestore realmente publicadas: <strong>NAO VERIFICADAS NESTA TELA.</strong> A auditoria R203 via API autenticada e indispensavel. Este checklist apenas organiza testes manuais e nunca libera o acesso da equipe.</p>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-950/55 p-3"><span className="text-xs font-semibold text-zinc-300">Verificacoes marcadas nesta sessao</span><span className="text-lg font-black tabular-nums text-amber-200">{summary.done}/{summary.total}</span></div>
      <p aria-live="polite" className="mt-2 text-[11px] text-amber-200">{summary.note}</p>
    </section>
    <section className="space-y-2" aria-label="Checklist de homologacao real">
      <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-sky-400"/><h2 className="text-sm font-black">Testes em aparelhos reais</h2></div>
      {RELEASE_CHECKS.map(item => <label key={item.id} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3 active:bg-zinc-800/70">
        <input type="checkbox" checked={checked.includes(item.id)} onChange={()=>toggle(item.id)} aria-label={`Conferido: ${item.title}`} className="mt-1 h-5 w-5 accent-emerald-500"/>
        <span className="min-w-0 flex-1"><strong className="block text-sm text-zinc-100">{item.title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{item.detail}</span></span>
        {checked.includes(item.id) && <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={16}/>}
      </label>)}
    </section>
    <button type="button" onClick={()=>void copy()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-200 active:scale-[.99]"><ClipboardCopy size={17}/> Copiar relatorio manual</button>
    <p className="text-[11px] leading-relaxed text-zinc-500">Os itens marcados nao sao salvos nem enviados ao servidor. Nenhum botao desta tela publica codigo, altera regras Firestore ou concede acesso. A aprovacao final permanece um procedimento separado e explicito.</p>
  </main>;
}
