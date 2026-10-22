'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, CheckCircle2, LockKeyhole, ShieldCheck, ShieldAlert, UsersRound, Boxes, ChevronRight, SearchCheck, ClipboardList, Fingerprint, FileCheck2, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid, roleLabel, type StaffAccessDraft } from '@/lib/access/roles';
import { loadStaffDrafts } from '@/lib/access/staffRepository';
import { StaffPageHeader, StaffPanel, StaffMetric, StaffNavRow, StaffEmpty } from '@/components/access/StaffPremium';

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
    <StaffPageHeader eyebrow="Proteção operacional" title="Auditoria de acessos" icon={ShieldCheck} onBack={()=>router.push('/mais/acessos')}/>
    <StaffPanel title="Isolamento por identidade" subtitle="Cada funcionário terá projeções mínimas por UID, separadas da sessão administrativa. As regras em produção continuam exclusivas do proprietário." icon={ShieldCheck} tone="green"/>
    <div className="grid grid-cols-3 gap-2"><StaffMetric label="Preparados" value={drafts.length} tone="green" icon={UsersRound}/><StaffMetric label="Rotas abertas" value={openRoutes.length} tone="sky" icon={Bike}/><StaffMetric label="Entregas" value={deliveries.length} tone="neutral" icon={Boxes}/></div>
    <StaffNavRow label="Gate de publicação R37" detail="Estado técnico separado da autorização de funcionários" icon={ClipboardList} tone="amber" onClick={()=>router.push('/mais/acessos/liberacao')}/>
    <StaffNavRow label="Orçamento de leituras R39" detail="Concorrência limitada, janela entre auditorias e custo por amostra" icon={BarChart3} tone="green" onClick={()=>router.push('/mais/acessos/leituras')}/>
    <StaffNavRow label="Centro de Evidências" detail="Conferência por conta, bloqueios e relatório seguro" icon={FileCheck2} tone="green" onClick={()=>router.push('/mais/acessos/evidencias')}/>
    <StaffNavRow label="Inspecionar projeções e permissões" detail="Amostras, padrões sensíveis e sinais de risco" icon={SearchCheck} tone="sky" onClick={()=>router.push('/mais/acessos/prontidao')}/>
    <StaffNavRow label="Conferir solicitações operacionais" detail="Entradas auditáveis, nenhuma operação é automática" icon={ClipboardList} tone="neutral" onClick={()=>router.push('/mais/acessos/solicitacoes')}/>
    <StaffNavRow label="Homologar vínculo Google" detail="UID real e conta suspensa, sem ativar login" icon={Fingerprint} tone="green" onClick={()=>router.push('/mais/acessos/homologacao')}/>
    <StaffNavRow label="Revogar acesso e limpar projeções" detail="Conferir UID, suspender e invalidar tokens" icon={LockKeyhole} tone="rose" onClick={()=>router.push('/mais/acessos/revogacao')}/>
    <StaffPanel title="Ativação continua bloqueada" subtitle="A homologação de segurança no emulador não ativa pessoas. Antes de liberar, faltam contas de teste, regras aprovadas e separação de domínios verificada." icon={ShieldAlert} tone="amber"/>
    <section className="space-y-2"><h2 className="text-sm font-black">Perfis e escopo previsto</h2>{!drafts.length&&!loadFailed&&<StaffEmpty title="Nenhum acesso preparado" subtitle="Cadastre primeiro um rascunho na área Equipe e permissões. O cadastro não ativa o login." icon={UsersRound}/>}{loadFailed && <p className="text-xs text-rose-300">Não foi possível carregar os rascunhos de acesso.</p>}{drafts.map(d => {const linked=motoboys.find(m=>m.id===d.linkedMotoboyId);const allowed=d.role==='motoboy' && linked ? openRoutes.filter(r=>r.motoboy_id===linked.id) : [];const deliveriesInRoutes=new Set(allowed.map(r=>r.id));const count=d.role==='motoboy' ? deliveries.filter(del=>del.route_id && deliveriesInRoutes.has(del.route_id)).length : 0;return <article key={d.id} className="rounded-[20px] border border-zinc-800 bg-zinc-900/45 p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{d.name}</h3><p className="mt-1 text-[11px] text-zinc-500">{roleLabel(d.role)} · {d.status==='suspenso'?'Suspenso':'Rascunho'}</p></div><LockKeyhole size={17} className="text-amber-400"/></div>{d.role==='motoboy' && <p className="mt-2 text-xs text-zinc-400">Vínculo: {linked?.name || 'Não atribuído'} · {allowed.length} rotas abertas · {count} entregas vinculadas</p>}{d.role==='compras'&&<p className="mt-2 text-xs text-zinc-400">Previsto: estoque e compras. Nenhuma rota ou informação financeira global.</p>}{d.role!=='motoboy'&&d.role!=='compras'&&<p className="mt-2 text-xs text-zinc-400">Escopo individual: {d.permissions.length} permissões configuradas no rascunho.</p>}</article>})}</section>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><p className="flex items-center gap-2 text-sm font-black"><ShieldAlert size={17} className="text-amber-400"/> Antes de ativar</p><p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Esta lista não é aprovação automática: cada ponto exige conferência humana. A auditoria por amostra não verifica as Rules de produção.</p><div className="mt-3 space-y-3 text-xs text-zinc-400">{['Validar regras no emulador: anônimo, suspenso, outras contas, acesso cruzado e escrita proibida','Inspecionar os documentos projetados: sem dados sensíveis ou campos extras; amostra não substitui auditoria integral','Vincular UID real ao cadastro e implementar ativação/revogação pelo backend','Separar completamente a persistência offline entre contas no APK e PWA','Homologar com uma conta de teste antes de cadastrar a equipe'].map((label,i)=><div key={i} className="flex gap-2.5"><CheckCircle2 className="shrink-0 text-zinc-600" size={15}/><span>{label}</span></div>)}</div></section>
    <button type="button" onClick={()=>router.push('/mais/acessos')} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 text-xs font-black">Voltar à equipe <ChevronRight size={16}/></button>
  </div>;
}
