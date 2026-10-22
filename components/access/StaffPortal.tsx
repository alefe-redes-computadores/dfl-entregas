'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { LockKeyhole, LogOut, Bike, Package, ShoppingBasket, Boxes, Home, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { staffAccountRef, fetchStaffRows } from '@/lib/access/staffPortalRepository';
import { toast } from '@/lib/operational-toast';
import { StaffConfirmDialog } from '@/components/access/StaffConfirmDialog';
import { staffTouch } from '@/lib/access/staffTouch';
import { submitStaffOperation } from '@/lib/access/staffOperationsClient';
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
  const [loadedArea, setLoadedArea] = useState<StaffArea | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [networkEpoch, setNetworkEpoch] = useState(0);
  const [requested, setRequested] = useState<Record<string,boolean>>({});
  const [quantities, setQuantities] = useState<Record<string,string>>({});
  const [sending, setSending] = useState<string | null>(null);
  // Trava sincrona: setState sozinho nao impede dois toques no mesmo frame.
  const sendingRef = useRef(false);
  const [pendingOperation, setPendingOperation] = useState<{row:StaffRow;kind:'delivery_confirmation'|'purchase_intent';quantity?:number}|null>(null);

  // Falhou a rede? Nao manter linhas ou permissoes anteriores na tela.
  // Ao voltar, refazer a assinatura e exigir resposta nova do servidor.
  useEffect(() => {
    const invalidate = () => {
      securityEpoch.current += 1;
      setRows([]); setLoadedArea(null); setRequested({});
      setAccount(null);
      setReason('Sem conexao: reconecte para validar novamente suas permissoes.');
      setPendingOperation(null);
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
  useEffect(() => { sendingRef.current=false; setRequested({}); setQuantities({}); setSending(null); }, [uid]); // Sessões nunca compartilham estado visual.

  useEffect(() => {
    let mounted = true;
    setAccount(null); setRows([]); setLoadedArea(null); setChecking(true);
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(staffAccountRef(uid), { includeMetadataChanges: true }, (snap) => {
        if (!mounted) return;
        securityEpoch.current += 1; // Inclui mudanca para cache ou revogacao.
        const verified = snap.exists() && !snap.metadata.fromCache ? parseStaffAccount(snap.data(), uid) : null;
        // Qualquer revisao da conta elimina registros antigos antes de nova consulta.
        setRows([]); setLoadedArea(null); setRequested({});
        setPendingOperation(null);
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
    if (!account || !allowed.length) {setRows([]);setLoadedArea(null); return;}
    if (!allowed.includes(section)) {setSection(allowed[0]); return;}
    let cancelled = false;
    const requestedEpoch = securityEpoch.current;
    setLoading(true); setRows([]); setLoadedArea(null);
    void fetchStaffRows(uid, section, account)
      .then((items) => { if (!cancelled && requestedEpoch === securityEpoch.current) {setRows(items);setLoadedArea(section);} })
      .catch(() => { if (!cancelled) {securityEpoch.current += 1;setRows([]);setAccount(null);setReason('Consulta não autorizada ou indisponível. Entre novamente após conferir suas permissões.');} })
      .finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [account, uid, section, refreshId, allowed]);

  const submitRequest=(row:StaffRow,kind:'delivery_confirmation'|'purchase_intent')=>{
    if(!account||!mayReadStaffArea(account,section)||sending||sendingRef.current||pendingOperation)return;
    let quantity:number|undefined;
    if(kind==='purchase_intent'){
      const raw=(quantities[row.id]||'').trim().replace(',','.');
      quantity=Number(raw);
      if(!Number.isFinite(quantity)||quantity<0.001||quantity>10000||Math.abs(quantity*1000-Math.round(quantity*1000))>1e-7){
        toast.warning('Quantidade inválida.',{description:'Informe de 0,001 a 10.000, com até três casas decimais.'});return;
      }
    }
    staffTouch();
    setPendingOperation({row,kind,quantity});
  };
  const sendConfirmed=async()=>{
    const pending=pendingOperation;
    if(!pending||!account||!mayReadStaffArea(account,pending.kind==='delivery_confirmation'?'deliveries':'stock')||sending||sendingRef.current)return;
    sendingRef.current=true;
    setPendingOperation(null);
    const key=pending.kind+':'+pending.row.id;
    setSending(key);
    const epoch = securityEpoch.current;
    try{
      await submitStaffOperation(pending.kind,pending.row.id,pending.quantity);
      // Uma resposta tardia não devolve estado/feedback da conta anterior após revogação.
      if (epoch !== securityEpoch.current) return;
      setRequested(current=>({...current,[key]:true}));
      toast.success('Solicitação enviada para conferência.',{description:'Nenhuma baixa ou movimentação de estoque foi aplicada.'});
    }catch(error){
      if (epoch === securityEpoch.current) toast.error('Solicitação não registrada.',{description:error instanceof Error?error.message:'Verifique a conexão e suas permissões.'});
    }finally{sendingRef.current=false;setSending(null);}
  };
  const signOut = () => {sendingRef.current=true;securityEpoch.current += 1;setRows([]);setLoadedArea(null);setRequested({});void logout();};
  // Nunca mostrar dados da aba anterior enquanto a nova consulta esta em curso.
  const visibleRows = loadedArea === section ? rows : [];
  const sectionLoading = loading || loadedArea !== section;
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
      <div className="flex flex-wrap gap-2">{allowed.map((area) => {const Icon=iconMap[area];return <button type="button" key={area} onClick={()=>{setPendingOperation(null);setSection(area);}} aria-pressed={section===area} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[11px] font-black ${section === area ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900/60 text-zinc-400'}`}><Icon size={15}/>{STAFF_SECTION_LABEL[area]}</button>;})}</div>
      <div className="flex items-center justify-between"><div><p className={`text-[10px] font-black uppercase tracking-widest ${colorMap[section]}`}>Minha área</p><h2 className="mt-1 font-heading text-xl font-black">{STAFF_SECTION_LABEL[section]}</h2></div><button type="button" disabled={loading} onClick={()=>setRefreshId((v)=>v+1)} aria-label="Atualizar dados" className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 text-zinc-400 disabled:opacity-40"><RefreshCw size={17}/></button></div>
      {sectionLoading && <p className="py-8 text-center text-sm text-zinc-500">Consultando dados autorizados...</p>}
      {!sectionLoading && !visibleRows.length && <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/50 p-6 text-center"><LockKeyhole className="mx-auto text-zinc-500" size={24}/><p className="mt-3 text-sm font-black">Nenhum registro disponibilizado</p><p className="mt-2 text-xs leading-relaxed text-zinc-500">Somente registros publicados pelo administrador aparecerão aqui. Não são carregados dados gerais da loja.</p></div>}
      <div className="space-y-2">{!sectionLoading && visibleRows.map((row) => <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-black">{row.title}</h3>{row.status && <span className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300">{row.status}</span>}</div>{row.subtitle && <p className="mt-1.5 text-xs text-zinc-400">{row.subtitle}</p>}
      {section==='deliveries' && account.permissions.includes('deliveries_complete') && (account.role==='operacao'||!!account.linkedMotoboyId) && row.status!=='Concluída' && row.status!=='Cancelada' && <button type="button" disabled={!!sending || !!requested['delivery_confirmation:'+row.id]} onClick={()=>void submitRequest(row,'delivery_confirmation')} className="mt-3 min-h-11 w-full rounded-[15px] border border-sky-500/25 bg-sky-500/10 px-3 text-xs font-black text-sky-200 disabled:opacity-40 active:scale-[.995]">{requested['delivery_confirmation:'+row.id]?'Aguardando conferência':'Solicitar conferência da entrega'}</button>}
      {section==='stock' && account.permissions.includes('purchases_write') && <div className="mt-3 flex gap-2"><input aria-label={'Quantidade a solicitar para '+row.title} inputMode="decimal" value={quantities[row.id] || ''} onChange={e=>setQuantities(curr=>({...curr,[row.id]:e.target.value}))} placeholder="Qtd." className="min-h-11 w-24 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-amber-400"/><button type="button" disabled={!!sending || !!requested['purchase_intent:'+row.id]} onClick={()=>void submitRequest(row,'purchase_intent')} className="min-h-11 flex-1 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2 text-[11px] font-black text-amber-200 disabled:opacity-40 active:scale-[.995]">{requested['purchase_intent:'+row.id]?'Aguardando conferência':'Solicitar lançamento'}</button></div>}
      </article>)}</div>
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[.04] p-3 text-[11px] leading-relaxed text-zinc-400">Você só pode consultar informações liberadas para sua conta. Outras áreas e operações são bloqueadas pelo servidor.</div>
    </main>
    {pendingOperation && <StaffConfirmDialog
      title={pendingOperation.kind==='delivery_confirmation'?'Solicitar conferência da entrega?':'Solicitar lançamento de compra?'}
      description={pendingOperation.kind==='delivery_confirmation'?'O administrador receberá o pedido. Esta ação NÃO finaliza a entrega.':'A quantidade será enviada para conferência. Nenhum saldo será alterado agora.'}
      detail={pendingOperation.row.title+(pendingOperation.quantity!==undefined?' · '+String(pendingOperation.quantity).replace('.',',')+' na unidade do produto':'')}
      confirmLabel="Enviar solicitação" tone="safe" onCancel={()=>setPendingOperation(null)} onConfirm={()=>void sendConfirmed()}/>}
  </div>;
}
