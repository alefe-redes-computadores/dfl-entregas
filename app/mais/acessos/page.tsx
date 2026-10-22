'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bike, Check, ChevronDown, Clock3, LockKeyhole, ClipboardList, Plus, Save,
  Search, Shield, ShieldCheck, ShieldOff, ShoppingBasket, SlidersHorizontal,
  UsersRound, X,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import {
  ACCESS_AREAS, STAFF_ROLES, isSuperadminUid, permissionsForRole,
  roleLabel, sanitizePermissions,
  type AccessPermission, type StaffAccessDraft, type StaffRole,
} from '@/lib/access/roles';
import { loadStaffDrafts, saveStaffDraft } from '@/lib/access/staffRepository';
import { StaffNavRow } from '@/components/access/StaffPremium';
import { StaffConfirmDialog } from '@/components/access/StaffConfirmDialog';
import { StaffChoicePicker } from '@/components/access/StaffChoicePicker';
import { StaffPermissionPreview } from '@/components/access/StaffPermissionPreview';
import { requiresMotoboyBinding } from '@/lib/access/staffInvitePolicy';
import { reviewStaffInvitation } from '@/lib/access/staffInvitationReview';
import { staffTouch } from '@/lib/access/staffTouch';

const GROUPS = ['Geral', 'Logistica', 'Loja', 'Gestao'] as const;
const roleIcons = { motoboy: Bike, compras: ShoppingBasket, operacao: UsersRound, personalizado: SlidersHorizontal };
type FormData = {
  name: string;
  email: string;
  role: StaffRole;
  permissions: AccessPermission[];
  linkedMotoboyId: string;
  linkedMemberId: string;
};
function emptyForm(): FormData {
  return { name: '', email: '', role: 'motoboy', permissions: permissionsForRole('motoboy'), linkedMotoboyId: '', linkedMemberId: '' };
}
const token = 'h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/60';

export default function StaffAccessPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const motoboys = useAppStore((s) => s.motoboys);
  const teamMembers = useAppStore((s) => s.teamMembers);
  const owner = isSuperadminUid(user?.uid);
  const [items, setItems] = useState<StaffAccessDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [expanded, setExpanded] = useState<string[]>(['Logistica']);
  const [pendingStatus, setPendingStatus] = useState<StaffAccessDraft|null>(null);

  const refresh = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    try { setItems(await loadStaffDrafts()); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível consultar os acessos.'); }
    finally { setLoading(false); }
  }, [owner]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => items.filter((item) =>
    `${item.name} ${item.email} ${roleLabel(item.role)}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim()),
  ), [items, search]);

  if (!owner) {
    return <div className="dfl-page p-5"><div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-center"><LockKeyhole className="mx-auto mb-3 text-red-400"/><h1 className="text-lg font-black">Acesso restrito</h1><p className="mt-2 text-sm text-zinc-400">Somente o superadministrador pode abrir esta área.</p></div></div>;
  }

  const startNew = () => { staffTouch(); setEditingId(null); setForm(emptyForm()); setEditing(true); };
  const startEdit = (item: StaffAccessDraft) => {
    staffTouch();
    setEditingId(item.id);
    setForm({ name: item.name, email: item.email, role: item.role, permissions: sanitizePermissions(item.permissions), linkedMotoboyId: item.linkedMotoboyId || '', linkedMemberId: item.linkedMemberId || '' });
    setEditing(true);
  };
  const chooseRole = (role: StaffRole) => {
    staffTouch();
    setForm((prev) => ({ ...prev, role, permissions: role === 'personalizado' ? prev.permissions : permissionsForRole(role),
      linkedMotoboyId: role === 'motoboy' || role === 'personalizado' ? prev.linkedMotoboyId : '',
    }));
  };
  const togglePermission = (permission: AccessPermission) => {
    staffTouch();
    if (permission === 'staff_admin') return;
    setForm((prev) => ({ ...prev, role: 'personalizado', permissions: prev.permissions.includes(permission)
      ? prev.permissions.filter((p) => p !== permission)
      : [...prev.permissions, permission],
    }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (form.name.trim().length < 2) return toast.error('Informe o nome do funcionário.');
    const email = form.email.trim().toLowerCase();
    if (email && items.some((item) => item.email === email && item.id !== editingId)) return toast.error('Este e-mail já tem um cadastro preparado.');
    setSaving(true);
    const previous = items.find((item) => item.id === editingId);
    const now = new Date().toISOString();
    const draft: StaffAccessDraft = {
      id: previous?.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      name: form.name.trim(), email, role: form.role,
      permissions: sanitizePermissions(form.permissions).filter((p) => p !== 'staff_admin'),
      status: previous?.status || 'rascunho',
      ...(form.linkedMotoboyId ? { linkedMotoboyId: form.linkedMotoboyId } : {}),
      ...(form.linkedMemberId ? { linkedMemberId: form.linkedMemberId } : {}),
      createdAt: previous?.createdAt || now, updatedAt: now,
      updatedByUid: user!.uid, activation: 'not_enabled',
    };
    try {
      await saveStaffDraft(draft, previous ? 'update' : 'create');
      setEditing(false); setEditingId(null); setForm(emptyForm());
      toast.success('Permissões preparadas. Acesso ainda não ativado.');
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao salvar as permissões.'); }
    finally { setSaving(false); }
  };
  const changeStatus = async (item: StaffAccessDraft) => {
    if (saving) return;
    setSaving(true);
    const suspend = item.status !== 'suspenso';
    try {
      await saveStaffDraft({ ...item, status: suspend ? 'suspenso' : 'rascunho' }, suspend ? 'suspend' : 'resume');
      toast.success(suspend ? 'Cadastro suspenso.' : 'Cadastro retornou aos rascunhos.');
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o cadastro.'); }
    finally { setSaving(false); }
  };

  return <div className="dfl-page space-y-5 pb-8">
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => router.push('/mais')} aria-label="Voltar" className="grid h-11 w-11 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/70 text-zinc-400"><ArrowLeft size={19}/></button>
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Administração</p><h1 className="font-heading text-xl font-black text-zinc-50">Equipe e permissões</h1></div>
    </div>

    <section className="space-y-2">
      <div className="px-1"><h2 className="text-xs font-black uppercase tracking-wide text-zinc-300">Central de equipe</h2><p className="mt-1 text-[11px] text-zinc-500">Segurança, identidade e operação em um só lugar.</p></div>
      <StaffNavRow tone="green" icon={ShieldCheck} label="Homologar Google e prévia de dados" detail="Verificar UID e conferir projeções antes do login" onClick={()=>router.push('/mais/acessos/homologacao')}/>
      <StaffNavRow tone="sky" icon={ClipboardList} label="Solicitações da equipe" detail="Revisar entregas e compras sem execução silenciosa" onClick={()=>router.push('/mais/acessos/solicitacoes')}/>
      <StaffNavRow tone="amber" icon={Shield} label="Prontidão da equipe" detail="Auditoria sob demanda, sem alterações" onClick={()=>router.push('/mais/acessos/prontidao')}/>
      <StaffNavRow tone="neutral" icon={LockKeyhole} label="Segurança e revogação" detail="Conferir vínculos e suspender contas" onClick={()=>router.push('/mais/acessos/seguranca')}/>
    </section>

    <section className="relative overflow-hidden rounded-[26px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.09] via-zinc-900/85 to-zinc-950 p-4">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400"><ShieldCheck size={22}/></span><div><p className="text-base font-black text-zinc-50">Seu controle, suas regras.</p><p className="mt-1 text-xs leading-relaxed text-zinc-400">Prepare quem pode acessar logística, estoque e compras. O acesso real só será liberado depois de concluir a proteção das consultas e das regras do Firebase.</p></div></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-zinc-950/65 px-2 py-3"><div className="text-xl font-black tabular-nums">{items.length}</div><p className="text-[9px] text-zinc-500">Preparados</p></div>
        <div className="rounded-2xl bg-zinc-950/65 px-2 py-3"><div className="text-xl font-black tabular-nums">{items.filter((item) => item.status === 'suspenso').length}</div><p className="text-[9px] text-zinc-500">Suspensos</p></div>
        <div className="rounded-2xl bg-zinc-950/65 px-2 py-3"><div className="text-xl font-black tabular-nums">0</div><p className="text-[9px] text-zinc-500">Liberados</p></div>
      </div>
    </section>

    <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[.055] p-3 text-xs leading-relaxed text-amber-100/80"><LockKeyhole className="shrink-0 text-amber-400" size={18}/><span>Segurança ativa: somente sua conta pode usar o aplicativo. Nenhum rascunho concede acesso ao banco.</span></div>

    {!editing && <>
      <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-base font-black">Contas de funcionários</h2><button type="button" onClick={startNew} className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-zinc-950"><Plus size={16}/> Preparar acesso</button></div>
      <div className="relative"><Search size={16} className="absolute left-4 top-3.5 text-zinc-500"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou perfil" className={`${token} pl-11`}/></div>
      {loading && <p className="py-7 text-center text-xs text-zinc-500">Consultando seus cadastros…</p>}
      {!loading && !filtered.length && <div className="rounded-3xl border border-dashed border-zinc-800 p-7 text-center"><UsersRound className="mx-auto text-zinc-600" size={26}/><p className="mt-3 text-sm font-black text-zinc-300">{items.length ? 'Nenhum resultado neste filtro.' : 'Nenhum funcionário preparado.'}</p><p className="mt-1 text-xs text-zinc-500">Você pode configurar tudo antes de convidar a equipe.</p></div>}
      <div className="space-y-2">{!loading && filtered.map((item) => {const Icon=roleIcons[item.role];return <article key={item.id} className="rounded-[21px] border border-zinc-800 bg-zinc-900/45 p-3.5"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-zinc-800/65 text-zinc-300"><Icon size={20}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.name}</p><p className="mt-0.5 truncate text-[11px] text-zinc-500">{item.email || 'E-mail ainda não definido'}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300">{roleLabel(item.role)}</span><span className="rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400">{item.status === 'suspenso'?'Suspenso':'Não ativado'}</span><span className="rounded-lg bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-400">{item.permissions.length} permissões</span></div></div></div><div className="mt-3 flex gap-2"><button type="button" onClick={()=>startEdit(item)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-200"><SlidersHorizontal size={14}/> Editar</button><button type="button" disabled={saving} onClick={()=>{staffTouch();setPendingStatus(item)}} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 disabled:opacity-50">{item.status === 'suspenso'?<Shield size={14}/>:<ShieldOff size={14}/>} {item.status === 'suspenso'?'Retomar':'Suspender'}</button></div></article>;})}</div>
    </>}

    {editing && <form onSubmit={(event)=>void submit(event)} className="space-y-4 rounded-[26px] border border-zinc-800 bg-zinc-900/35 p-4">
      <div className="flex items-center justify-between"><h2 className="font-heading text-lg font-black">{editingId?'Editar permissões':'Preparar funcionário'}</h2><button type="button" onClick={()=>setEditing(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-800 text-zinc-400"><X size={17}/></button></div>
      <label className="block space-y-1.5"><span className="text-xs font-bold text-zinc-300">Nome do funcionário</span><input required maxLength={120} value={form.name} onChange={(event)=>setForm((v)=>({...v,name:event.target.value}))} placeholder="Nome completo" className={token}/></label>
      <label className="block space-y-1.5"><span className="text-xs font-bold text-zinc-300">E-mail Google (para vínculo futuro)</span><input type="email" maxLength={160} value={form.email} onChange={(event)=>setForm((v)=>({...v,email:event.target.value}))} placeholder="pessoa@gmail.com" className={token}/></label>
      <div><p className="mb-2 text-xs font-bold text-zinc-300">Perfil inicial</p><div className="grid grid-cols-2 gap-2">{STAFF_ROLES.map((role)=>{const Icon=roleIcons[role.id];const selected=form.role===role.id;return <button key={role.id} type="button" onClick={()=>chooseRole(role.id)} className={`min-h-[85px] rounded-2xl border p-3 text-left transition ${selected?'border-emerald-500/55 bg-emerald-500/[.08] text-emerald-300':'border-zinc-800 bg-zinc-950/45 text-zinc-400'}`}><Icon size={18}/><p className="mt-1.5 text-xs font-black">{role.label}</p><p className="mt-0.5 text-[10px] leading-snug opacity-75">{role.subtitle}</p></button>})}</div></div>
      {requiresMotoboyBinding(form.role,form.permissions) && <div className="space-y-1.5"><StaffChoicePicker label="Vincular cadastro de motoboy" value={form.linkedMotoboyId} placeholder="Selecionar depois" options={[{value:'',label:'Selecionar depois'},...motoboys.map(m=>({value:m.id,label:m.name,description:m.active?'Em escala':'Fora da escala'}))]} onChange={value=>setForm(v=>({...v,linkedMotoboyId:value}))}/><p className="text-[10px] text-zinc-500">Obrigatório para convite com logística individual. O vínculo não ativa acesso nem libera rotas.</p></div>}
      <StaffChoicePicker label="Vincular integrante da loja (opcional)" value={form.linkedMemberId} placeholder="Sem vínculo" options={[{value:'',label:'Sem vínculo'},...teamMembers.map(m=>({value:m.id,label:m.name}))]} onChange={value=>setForm(v=>({...v,linkedMemberId:value}))}/>
      <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black">Permissões por função</p><p className="text-[11px] text-zinc-500">Alterações ativam o perfil Personalizado.</p></div><span className="rounded-lg border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400">{form.permissions.length} marcadas</span></div>
      <div className="space-y-2">{GROUPS.map((group)=>{const entries=ACCESS_AREAS.filter((item)=>item.group===group && item.id!=='staff_admin');const isOpen=expanded.includes(group);return <div key={group} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/55"><button type="button" onClick={()=>setExpanded((groups)=>isOpen?groups.filter((x)=>x!==group):[...groups,group])} className="flex w-full items-center justify-between px-3.5 py-3 text-left"><span className="text-xs font-black text-zinc-200">{group} <span className="ml-1 text-[10px] font-normal text-zinc-500">{entries.filter((e)=>form.permissions.includes(e.id)).length}/{entries.length}</span></span><ChevronDown size={16} className={`text-zinc-500 transition ${isOpen?'rotate-180':''}`}/></button>{isOpen && <div className="space-y-1 border-t border-zinc-800 px-2.5 py-2">{entries.map((item)=>{const checked=form.permissions.includes(item.id);return <button type="button" key={item.id} onClick={()=>togglePermission(item.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-zinc-900"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked?'border-emerald-400 bg-emerald-500 text-zinc-950':'border-zinc-700 bg-zinc-900'}`}>{checked&&<Check size={14}/>}</span><span className="min-w-0"><span className="block text-xs font-bold text-zinc-200">{item.label}</span><span className="block text-[10px] text-zinc-500">{item.description}</span></span></button>})}</div>}</div>})}</div>
      <StaffPermissionPreview role={form.role} permissions={form.permissions} linkedMotoboyId={form.linkedMotoboyId}/>
      {(() => {
        const review = reviewStaffInvitation({...form, activation:'not_enabled', status:'rascunho'});
        return <section aria-label="Conferência antes da homologação" className={`rounded-2xl border p-3.5 ${review.readyForHomologation ? 'border-emerald-500/25 bg-emerald-500/[.04]' : 'border-amber-500/25 bg-amber-500/[.045]'}`}>
          <p className={`text-xs font-black ${review.readyForHomologation?'text-emerald-300':'text-amber-300'}`}>{review.readyForHomologation?'Pronto para solicitar homologação':'Antes de homologar este convite'}</p>
          {review.readyForHomologation ? <p className="mt-1 text-[11px] text-zinc-400">Cadastro preparado para conferir a identidade Google. Ainda sem login ou autorização.</p>
          : <ul className="mt-2 space-y-1">{review.issues.map(issue=><li key={issue} className="text-[11px] leading-relaxed text-zinc-400">• {issue}</li>)}</ul>}
        </section>;
      })()}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90"><Clock3 className="mr-2 inline-block" size={14}/> Apenas preparação: salvar não ativa login e não altera as regras publicadas.</div>
      <div className="flex gap-2"><button type="button" disabled={saving} onClick={()=>setEditing(false)} className="h-12 flex-1 rounded-2xl border border-zinc-800 text-xs font-black text-zinc-400">Cancelar</button><button type="submit" disabled={saving} className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xs font-black text-zinc-950 disabled:opacity-50"><Save size={17}/>{saving?'Salvando…':'Salvar rascunho'}</button></div>
    </form>}
    {pendingStatus&&<StaffConfirmDialog title={pendingStatus.status==='suspenso'?'Retornar ao rascunho?':'Suspender rascunho?'} description={pendingStatus.status==='suspenso'?'A conta voltará apenas ao estado de preparação. Isso NÃO libera login.':'O cadastro será marcado como suspenso. O login já permanece bloqueado nas regras de produção.'} detail={`${pendingStatus.name} · ${roleLabel(pendingStatus.role)}`} tone={pendingStatus.status==='suspenso'?'safe':'caution'} requirePhrase={pendingStatus.status==='suspenso'?undefined:'SUSPENDER'} confirmLabel={pendingStatus.status==='suspenso'?'Retornar a rascunho':'Suspender'} busy={saving} onCancel={()=>setPendingStatus(null)} onConfirm={()=>{const item=pendingStatus;setPendingStatus(null);if(item)void changeStatus(item)}}/>}
  </div>;
}
