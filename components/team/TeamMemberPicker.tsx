// components/team/TeamMemberPicker.tsx
'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { TeamMember, TeamMemberRole } from '@/types';

const roles: Array<[TeamMemberRole, string]> = [
  ['administracao', 'Administração'], ['compras', 'Compras'], ['cozinha', 'Cozinha'],
  ['atendimento', 'Atendimento'], ['entrega', 'Entrega'], ['outro', 'Outro'],
];

export function TeamMemberPicker({ value, onChange }: { value?: string; onChange: (member: TeamMember) => void }) {
  const members = useAppStore((state) => state.teamMembers);
  const addMember = useAppStore((state) => state.addTeamMember);
  const user = useAppStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('compras');
  const active = useMemo(() => members.filter((item) => item.active), [members]);
  const selected = members.find((item) => item.id === value);

  const create = async () => {
    const clean = name.trim();
    if (clean.length < 2) return toast.error('Informe o nome da pessoa.');
    const now = new Date().toISOString();
    const member: TeamMember = { id: `team-${Date.now()}`, name: clean, role, active: true, created_at: now, updated_at: now };
    await addMember(member); onChange(member); setCreating(false); setOpen(false); setName('');
    toast.success('Pessoa adicionada à equipe.');
  };

  return <div>
    <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 text-left active:scale-[.99]">
      <UserRound size={18} className="text-amber-400"/><span className="flex-1"><span className="block text-sm font-bold text-zinc-100">{selected?.name || user?.displayName || 'Selecionar pessoa'}</span><span className="block text-[10px] text-zinc-500">Vínculo com a equipe</span></span>
    </button>
    {open && <div className="fixed inset-0 z-[80] flex items-end bg-black/75 p-3 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between"><div><h3 className="font-heading text-lg font-black text-zinc-100">Quem realizou a compra?</h3><p className="text-xs text-zinc-500">Selecione alguém da equipe.</p></div><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-zinc-400"><X size={18}/></button></div>
        {!creating ? <><div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{active.map((member) => <button type="button" key={member.id} onClick={() => { onChange(member); setOpen(false); }} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 font-black text-amber-400">{member.name.charAt(0)}</span><span className="flex-1"><b className="block text-sm text-zinc-100">{member.name}</b><small className="text-zinc-500">{roles.find(([key]) => key === member.role)?.[1]}</small></span>{member.id === value && <Check size={18} className="text-emerald-400"/>}</button>)}</div><button type="button" onClick={() => setCreating(true)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/30 text-sm font-black text-amber-400"><Plus size={17}/>Cadastrar pessoa</button></> : <div className="mt-5 space-y-4"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pessoa" className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 outline-none focus:border-amber-500"/><div className="grid grid-cols-2 gap-2">{roles.map(([key, label]) => <button type="button" key={key} onClick={() => setRole(key)} className={`h-11 rounded-xl border text-xs font-bold ${role === key ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{label}</button>)}</div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl bg-zinc-900 font-bold text-zinc-400">Voltar</button><button type="button" onClick={create} className="h-12 rounded-xl bg-amber-500 font-black text-zinc-950">Cadastrar</button></div></div>}
      </div>
    </div>}
  </div>;
}
