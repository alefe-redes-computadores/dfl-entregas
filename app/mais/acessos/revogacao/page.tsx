'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LockKeyhole, Search, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { staffRevocationRequest, type RevocationResponse } from '@/lib/access/staffRevocationClient';

/** R24: revogação manual e confirmada. NÃO contém botão para ativar funcionários. */
export default function RevogacaoPage() {
  const router = useRouter();
  const owner = useAppStore(s => isSuperadminUid(s.user?.uid));
  const [uid, setUid] = useState('');
  const [info, setInfo] = useState<NonNullable<RevocationResponse['account']> | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  if (!owner) return <div className="dfl-page p-6 text-center text-sm text-rose-300">Acesso restrito ao administrador.</div>;

  const inspect = async () => {
    setBusy(true); setError(''); setInfo(null); setConfirmed(false); setResult('');
    try {
      const response = await staffRevocationRequest('inspect', uid.trim());
      setInfo(response.account || null);
    } catch(e) { setError(e instanceof Error ? e.message : 'Falha na consulta.'); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!info || !confirmed || busy) return;
    setBusy(true); setError(''); setResult('');
    try {
      const response = await staffRevocationRequest('revoke', info.uid, info.updatedAt);
      setInfo(null); setConfirmed(false);
      setResult(response.warnings?.length
        ? `Conta suspensa. Pendências: ${response.warnings.join(' ')}`
        : `Acesso suspenso, tokens invalidados e ${response.removed || 0} projeções removidas.`);
    } catch(e) { setInfo(null); setConfirmed(false); setError(e instanceof Error ? e.message : 'Falha na revogação. Consulte novamente.'); }
    finally { setBusy(false); }
  };
  return <div className="dfl-page space-y-4 pb-28">
    <header className="flex items-center gap-3"><button type="button" aria-label="Voltar" onClick={()=>router.push('/mais/acessos/seguranca')} className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-800"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-rose-400">Segurança da equipe</p><h1 className="font-heading text-xl font-black">Revogar acesso</h1></div></header>
    <section className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[.08] to-zinc-900/35 p-4"><ShieldAlert size={24} className="text-amber-400"/><h2 className="mt-3 text-sm font-black">Suspender antes de apagar</h2><p className="mt-1 text-xs leading-relaxed text-zinc-400">A operação suspende a conta no Firebase, remove permissões e tenta eliminar as projeções individuais. Não apaga entregas, rotas ou estoque da loja. Ainda não libera novos logins.</p></section>
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"><label htmlFor="uid-revocation" className="text-xs font-bold text-zinc-300">UID da conta Google vinculada</label><input id="uid-revocation" autoComplete="off" spellCheck={false} value={uid} onChange={e=>{setUid(e.target.value);setInfo(null);setConfirmed(false);setResult('');}} placeholder="Cole o UID completo" className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-sm outline-none focus:border-amber-400"/><button type="button" disabled={busy || uid.trim().length<8} onClick={()=>void inspect()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 font-black text-zinc-950 disabled:opacity-40"><Search size={17}/> {busy?'Consultando...':'Conferir identidade e estado'}</button></section>
    {info && <section className="space-y-3 rounded-3xl border border-rose-500/20 bg-rose-500/[.04] p-4"><div className="flex items-center gap-2 text-rose-300"><LockKeyhole size={17}/><h2 className="text-sm font-black">Confirme o alvo</h2></div><div className="space-y-1 text-sm"><p className="font-bold text-zinc-100">{info.displayName || 'Conta sem nome'}</p><p className="text-xs text-zinc-400">Perfil: {info.role} · Estado: {info.status==='active'?'Ativo':'Suspenso'}</p><p className="break-all font-mono text-[10px] text-zinc-500">UID: {info.uid}</p></div><label className="flex items-start gap-3 rounded-2xl border border-zinc-800 p-3 text-xs leading-relaxed text-zinc-300"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Confirmei o UID acima. Entendo que a conta será suspensa e suas projeções serão removidas, sem afetar o banco administrativo.</span></label><button type="button" onClick={()=>void revoke()} disabled={busy || !confirmed} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/35 bg-rose-600 text-sm font-black text-white disabled:opacity-40"><Trash2 size={17}/> Revogar e limpar acesso</button></section>}
    {error && <p role="alert" className="rounded-2xl border border-rose-500/20 bg-rose-500/[.06] p-3 text-xs text-rose-300">{error}</p>}
    {result && <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-3 text-xs text-emerald-300"><ShieldCheck size={18}/>{result}</p>}
  </div>;
}
