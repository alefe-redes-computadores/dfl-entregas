'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bike, CheckCircle2, LockKeyhole, ShieldCheck, ShieldAlert, UsersRound, Boxes, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid, roleLabel, type StaffAccessDraft } from '@/lib/access/roles';
import { loadStaffDrafts } from '@/lib/access/staffRepository';

/** Auditoria local: visualiza a divisao de responsabilidades SEM liberar ou publicar contas. */
export default function SecurityReadinessPage() {
  const router = useRouter();
  const uid = useAppStore(s => s.user?.uid);
  const motoboys = useAppStore(s => s.motoboys);
  const routes = useAppStore(s => s.routes);
  const deliveries = useAppStore(s => s.deliveries);
  const [drafts, setDrafts] = useState<StaffAccessDraft[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const owner = isSuperadminUid(uid);
  useEffect(() => {
    if (!owner) return;
    let alive = true;
    void loadStaffDrafts().then(items => { if (alive) setDrafts(items); }).catch(() => {if (alive) setLoadFailed(true);});
    return () => { alive = false; };
  }, [owner]);
  const openRoutes = useMemo(() => routes.filter(r => r.status === 'aberta'), [routes]);
  if (!owner) return <div className="dfl-page p-6 text-center text-sm text-rose-300">Acesso restrito ao administrador.</div>;

  return <div className="dfl-page space-y-4 pb-28">
    <header className="flex items-center gap-3"><button type="button" onClick={()=>router.push('/mais/acessos')} className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-800"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Administração</p><h1 className="font-heading text-xl font-black">Auditoria de acessos</h1></div></header>
    <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.07] to-zinc-900/40 p-4"><ShieldCheck className="text-emerald-400" size={24}/><h2 className="mt-3 text-base font-black">Separação real, sem vazamento</h2><p className="mt-1 text-xs leading-relaxed text-zinc-400">O app administrativo carrega dados completos. O portal de funcionários foi criado separadamente para trabalhar apenas com projeções por UID, sem compartilhar o estado global da loja.</p></div>
    <div className="grid grid-cols-3 gap-2"><Metric label="Preparados" value={drafts.length} icon={UsersRound}/><Metric label="Rotas abertas" value={openRoutes.length} icon={Bike}/><Metric label="Entregas" value={deliveries.length} icon={Boxes}/></div>
    <button type="button" onClick={()=>router.push('/mais/acessos/revogacao')} className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-rose-500/25 bg-rose-500/[.045] px-4 text-left"><span className="flex items-center gap-2 text-sm font-black text-rose-300"><LockKeyhole size={17}/> Revogar acesso e limpar projeções</span><ChevronRight size={16} className="text-rose-400"/></button>
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-4"><div className="flex items-center gap-2 text-sm font-black text-amber-300"><LockKeyhole size={16}/> Ativação bloqueada</div><p className="mt-1.5 text-xs leading-relaxed text-zinc-400">Nenhuma conta é liberada nesta versão. As regras atuais seguem restritas ao superadministrador. A futura política do Firestore só será publicada depois dos testes com emulador e de uma homologação com conta de funcionário.</p></div>
    <section className="space-y-2"><h2 className="text-sm font-black">Perfis e escopo previsto</h2>{loadFailed && <p className="text-xs text-rose-300">Não foi possível carregar os rascunhos de acesso.</p>}{drafts.map(d => {const linked=motoboys.find(m=>m.id===d.linkedMotoboyId);const allowed=d.role==='motoboy' && linked ? openRoutes.filter(r=>r.motoboy_id===linked.id) : [];const deliveriesInRoutes=new Set(allowed.map(r=>r.id));const count=d.role==='motoboy' ? deliveries.filter(del=>del.route_id && deliveriesInRoutes.has(del.route_id)).length : 0;return <article key={d.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{d.name}</h3><p className="mt-1 text-[11px] text-zinc-500">{roleLabel(d.role)} · {d.status==='suspenso'?'Suspenso':'Rascunho'}</p></div><LockKeyhole size={17} className="text-amber-400"/></div>{d.role==='motoboy' && <p className="mt-2 text-xs text-zinc-400">Vínculo: {linked?.name || 'Não atribuído'} · {allowed.length} rotas abertas · {count} entregas vinculadas</p>}{d.role==='compras'&&<p className="mt-2 text-xs text-zinc-400">Previsto: estoque e compras. Nenhuma rota ou informação financeira global.</p>}{d.role!=='motoboy'&&d.role!=='compras'&&<p className="mt-2 text-xs text-zinc-400">Escopo individual: {d.permissions.length} permissões configuradas no rascunho.</p>}</article>})}</section>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><p className="flex items-center gap-2 text-sm font-black"><ShieldAlert size={17} className="text-amber-400"/> Antes de ativar</p><div className="mt-3 space-y-3 text-xs text-zinc-400">{['Validar regras no emulador: anônimo, suspenso, outras contas, acesso cruzado e escrita proibida','Publicar as projeções mínimas e validar que não contenham saldo, custo, acerto ou informações de outros motoboys','Vincular UID real ao cadastro e implementar ativação/revogação pelo backend','Separar completamente a persistência offline entre contas no APK e PWA','Homologar com uma conta de teste antes de cadastrar a equipe'].map((label,i)=><div key={i} className="flex gap-2.5"><CheckCircle2 className="shrink-0 text-zinc-600" size={15}/><span>{label}</span></div>)}</div></section>
    <button type="button" onClick={()=>router.push('/mais/acessos')} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 text-xs font-black">Voltar à equipe <ChevronRight size={16}/></button>
  </div>;
}
function Metric({label,value,icon:Icon}:{label:string,value:number,icon:typeof Bike}) {return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3"><Icon size={18} className="text-zinc-400"/><div className="mt-2 text-xl font-black tabular-nums">{value}</div><div className="mt-0.5 text-[10px] text-zinc-500">{label}</div></div>}
