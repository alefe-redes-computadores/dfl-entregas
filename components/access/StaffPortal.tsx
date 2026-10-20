'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { LockKeyhole, LogOut, Bike, Package, ShoppingBasket, Boxes, Home, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { staffAccountRef, fetchStaffRows } from '@/lib/access/staffPortalRepository';
import {
  STAFF_AREAS, STAFF_SECTION_LABEL, mayReadStaffArea, parseStaffAccount,
  type StaffAccount, type StaffArea, type StaffRow,
} from '@/lib/access/staffRuntime';

const iconMap = { home: Home, routes: Bike, deliveries: Package, stock: Boxes, purchases: ShoppingBasket };
const colorMap = { home: 'text-emerald-400', routes: 'text-sky-400', deliveries: 'text-sky-400', stock: 'text-amber-400', purchases: 'text-amber-400' };

/** Visao isolada de funcionarios. NUNCA renderiza Header/BottomNav/automacoes admin. */
export function StaffPortal({ uid }: { uid: string }) {
  const logout = useAppStore((s) => s.logout);
  const [account, setAccount] = useState<StaffAccount | null>(null);
  const [checking, setChecking] = useState(true);
  const [reason, setReason] = useState('Aguardando autorização do administrador.');
  const [section, setSection] = useState<StaffArea>('home');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [networkEpoch, setNetworkEpoch] = useState(0);

  // Falhou a rede? Nao manter linhas ou permissoes anteriores na tela.
  // Ao voltar, refazer a assinatura e exigir resposta nova do servidor.
  useEffect(() => {
    const invalidate = () => {
      securityEpoch.current += 1;
      setRows([]);
      setAccount(null);
      setReason('Sem conexao: reconecte para validar novamente suas permissoes.');
    };
    const reconnect = () => {
      invalidate();
      setChecking(true);
      setNetworkEpoch((n) => n + 1);
    };
    window.addEventListener('offline', invalidate);
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener('offline', invalidate);
      window.removeEventListener('online', reconnect);
    };
  }, []);
  const securityEpoch = useRef(0); // Invalida consultas em voo ao perder autorizacao.

  useEffect(() => {
    let mounted = true;
    setAccount(null); setRows([]); setChecking(true);
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(staffAccountRef(uid), { includeMetadataChanges: true }, (snap) => {
        if (!mounted) return;
        securityEpoch.current += 1; // Inclui mudanca para cache ou revogacao.
        const verified = snap.exists() && !snap.metadata.fromCache ? parseStaffAccount(snap.data(), uid) : null;
        // Qualquer revisao da conta elimina registros antigos antes de nova consulta.
        setRows([]);
        setAccount(verified?.status === 'active' ? verified : null);
        setReason(snap.metadata.fromCache ? 'Conecte-se à internet para validar suas permissões.' : verified?.status === 'suspended' ? 'Este acesso foi suspenso pelo administrador.' : 'Conta ainda não autorizada. Solicite liberação ao administrador.');
        setChecking(false);
      }, () => {
        if (!mounted) return;
        securityEpoch.current += 1;
        setAccount(null); setRows([]); setChecking(false);
        setReason('Acesso bloqueado: permissão não concedida no Firebase.');
      });
    } catch {
      setChecking(false); setAccount(null); setRows([]);
      setReason('Não foi possível conferir as permissões.');
    }
    return () => { mounted = false; securityEpoch.current += 1; unsubscribe(); setRows([]); };
  }, [uid, networkEpoch]);

  const allowed = useMemo(() => STAFF_AREAS.filter((area) => mayReadStaffArea(account, area)), [account]);
  useEffect(() => {
    if (!account || !allowed.length) {setRows([]); return;}
    if (!allowed.includes(section)) {setSection(allowed[0]); return;}
    let cancelled = false;
    const requestedEpoch = securityEpoch.current;
    setLoading(true); setRows([]);
    void fetchStaffRows(uid, section, account)
      .then((items) => { if (!cancelled && requestedEpoch === securityEpoch.current) setRows(items); })
      .catch(() => { if (!cancelled) {securityEpoch.current += 1;setRows([]);setAccount(null);setReason('Consulta não autorizada ou indisponível. Entre novamente após conferir suas permissões.');} })
      .finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [account, uid, section, refreshId, allowed]);

  const signOut = () => void logout();
  if (checking || !account) {
    return <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-7 text-center text-zinc-100">
      <span className="grid h-16 w-16 place-items-center rounded-3xl border border-amber-500/30 bg-amber-500/10 text-amber-400"><LockKeyhole size={29}/></span>
      <h1 className="mt-5 font-heading text-2xl font-black">{checking ? 'Verificando acesso' : 'Acesso restrito'}</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">{checking ? 'Validando sua conta diretamente com o Firebase.' : reason}</p>
      {!checking && <button type="button" onClick={signOut} className="mt-7 flex h-12 items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-6 text-sm font-bold"><LogOut size={16}/> Sair da conta</button>}
    </div>;
  }
  return <div className="min-h-screen bg-zinc-950 text-zinc-100">
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-4 pt-8 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400"><ShieldCheck size={13}/> Acesso individual</p><h1 className="mt-1 truncate font-heading text-xl font-black">{account.displayName || 'Equipe DFL'}</h1><p className="mt-1 text-xs text-zinc-500">Somente informações autorizadas</p></div>
        <button type="button" aria-label="Sair da conta" onClick={signOut} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400"><LogOut size={18}/></button>
      </div>
    </header>
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-5">
      <div className="flex flex-wrap gap-2">{allowed.map((area) => {const Icon=iconMap[area];return <button type="button" key={area} onClick={()=>setSection(area)} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[11px] font-black ${section === area ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900/60 text-zinc-400'}`}><Icon size={15}/>{STAFF_SECTION_LABEL[area]}</button>;})}</div>
      <div className="flex items-center justify-between"><div><p className={`text-[10px] font-black uppercase tracking-widest ${colorMap[section]}`}>Minha área</p><h2 className="mt-1 font-heading text-xl font-black">{STAFF_SECTION_LABEL[section]}</h2></div><button type="button" disabled={loading} onClick={()=>setRefreshId((v)=>v+1)} aria-label="Atualizar dados" className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 text-zinc-400 disabled:opacity-40"><RefreshCw size={17}/></button></div>
      {loading && <p className="py-8 text-center text-sm text-zinc-500">Consultando dados autorizados...</p>}
      {!loading && !rows.length && <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/50 p-6 text-center"><LockKeyhole className="mx-auto text-zinc-500" size={24}/><p className="mt-3 text-sm font-black">Nenhum registro disponibilizado</p><p className="mt-2 text-xs leading-relaxed text-zinc-500">Somente registros publicados pelo administrador aparecerão aqui. Não são carregados dados gerais da loja.</p></div>}
      <div className="space-y-2">{!loading && rows.map((row) => <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-black">{row.title}</h3>{row.status && <span className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300">{row.status}</span>}</div>{row.subtitle && <p className="mt-1.5 text-xs text-zinc-400">{row.subtitle}</p>}</article>)}</div>
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[.04] p-3 text-[11px] leading-relaxed text-zinc-400">Você só pode consultar informações liberadas para sua conta. Outras áreas e operações são bloqueadas pelo servidor.</div>
    </main>
  </div>;
}
