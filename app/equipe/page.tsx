// app/equipe/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bike,
  ChevronRight,
  Edit3,
  Save,
  Search,
  UserCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import type { TeamMember, TeamMemberRole } from '@/types';

const roles: Array<[TeamMemberRole, string]> = [
  ['administracao', 'Administração'],
  ['compras', 'Compras'],
  ['cozinha', 'Cozinha'],
  ['atendimento', 'Atendimento'],
  ['entrega', 'Apoio de entrega'],
  ['outro', 'Outro'],
];

const empty = {
  name: '',
  phone: '',
  observation: '',
  role: 'compras' as TeamMemberRole,
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function TeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const members = useAppStore((state) => state.teamMembers);
  const motoboys = useAppStore((state) => state.motoboys);
  const add = useAppStore((state) => state.addTeamMember);
  const update = useAppStore((state) => state.updateTeamMember);
  const updateMotoboy = useAppStore((state) => state.updateMotoboy);

  const [editing, setEditing] = useState<TeamMember | null | undefined>(undefined);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (searchParams.get('add') === 'interno') {
      setForm(empty);
      setEditing(null);
    }
  }, [searchParams]);

  const filteredMembers = useMemo(() => {
    const term = normalize(query.trim());
    return [...members]
      .filter((member) => !term || normalize(member.name).includes(term))
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          a.name.localeCompare(b.name, 'pt-BR'),
      );
  }, [members, query]);

  const filteredMotoboys = useMemo(() => {
    const term = normalize(query.trim());
    return [...motoboys]
      .filter((motoboy) => !term || normalize(motoboy.name).includes(term))
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          a.name.localeCompare(b.name, 'pt-BR'),
      );
  }, [motoboys, query]);

  const openNew = () => {
    setForm(empty);
    setEditing(null);
  };

  const openEdit = (member: TeamMember) => {
    setForm({
      name: member.name,
      phone: member.phone || '',
      observation: member.observation || '',
      role: member.role,
    });
    setEditing(member);
  };

  const save = async () => {
    if (form.name.trim().length < 2) {
      toast.error('Informe o nome.');
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await update(editing.id, {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          observation: form.observation.trim() || undefined,
          role: form.role,
        });
        toast.success('Integrante atualizado.');
      } else {
        const now = new Date().toISOString();
        await add({
          id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          observation: form.observation.trim() || undefined,
          role: form.role,
          active: true,
          created_at: now,
          updated_at: now,
        });
        toast.success('Integrante cadastrado.');
      }

      setEditing(undefined);
    } catch {
      toast.error('Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const toggleMember = async (member: TeamMember) => {
    try {
      await update(member.id, { active: !member.active });
    } catch {
      toast.error('Não foi possível alterar o status.');
    }
  };

  const toggleMotoboy = async (id: string, active: boolean) => {
    try {
      await updateMotoboy(id, { active: !active });
    } catch {
      toast.error('Não foi possível alterar a escala.');
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <PageHeader
        title="Equipe"
        subtitle="Pessoas da loja e entregadores"
        to="/loja"
      />

      <div className="grid grid-cols-3 gap-2">
        <Metric
          value={members.filter((member) => member.active).length}
          label="Internos ativos"
        />
        <Metric
          value={motoboys.filter((motoboy) => motoboy.active).length}
          label="Entregadores"
        />
        <Metric
          value={members.length + motoboys.length}
          label="Cadastros"
        />
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pessoa"
          className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm outline-none focus:border-violet-500"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-400">
              Lanchonete
            </p>
            <h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">
              Equipe interna
            </h2>
          </div>

        </div>

        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <article
              key={member.id}
              className={`rounded-[20px] border p-3.5 ${
                member.active
                  ? 'border-zinc-800 bg-zinc-900/45'
                  : 'border-zinc-900 bg-zinc-950/30 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 font-black text-violet-400">
                  {member.name.charAt(0).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-zinc-100">
                    {member.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {roles.find(([role]) => role === member.role)?.[1] || member.role}
                    {member.phone ? ` · ${member.phone}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleMember(member)}
                  className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black ${
                    member.active
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {member.active ? 'Ativo' : 'Inativo'}
                </button>

                <button
                  type="button"
                  onClick={() => openEdit(member)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </article>
          ))}

          {filteredMembers.length === 0 && (
            <Empty text="Nenhum integrante interno neste filtro." />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-400">
              Entregas
            </p>
            <h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">
              Entregadores / motoboys
            </h2>
          </div>

        </div>

        <div className="space-y-2">
          {filteredMotoboys.map((motoboy) => (
            <article
              key={motoboy.id}
              className={`rounded-[20px] border p-3.5 ${
                motoboy.active
                  ? 'border-sky-500/15 bg-sky-500/[.025]'
                  : 'border-zinc-800 bg-zinc-900/35 opacity-65'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    motoboy.active
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  <Bike size={18} />
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/motoboys/details?id=${motoboy.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-zinc-100">
                      {motoboy.name}
                    </p>
                    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[8px] font-black uppercase text-zinc-500">
                      {motoboy.type || 'fixo'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    Cadastro, regra de pagamento, histórico e acerto
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => toggleMotoboy(motoboy.id, motoboy.active)}
                  className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black ${
                    motoboy.active
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {motoboy.active ? 'Escalado' : 'Fora'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/motoboys/details?id=${motoboy.id}`)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-500"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </article>
          ))}

          {filteredMotoboys.length === 0 && (
            <Empty text="Nenhum entregador neste filtro." />
          )}
        </div>

        <button
          type="button"
          onClick={() => router.push('/motoboys')}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-xs font-black text-zinc-400"
        >
          <UsersRound size={15} />
          Abrir gestão completa de entregadores
        </button>
      </section>

      {editing !== undefined && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => !busy && setEditing(undefined)}
        >
          <section
            className="w-full max-w-md rounded-[30px] border border-zinc-800 bg-zinc-950 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-400">
                  Equipe interna
                </p>
                <h2 className="mt-1 text-lg font-black text-zinc-100">
                  {editing ? 'Editar integrante' : 'Novo integrante'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(undefined)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nome"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-violet-500"
              />

              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="Telefone"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-violet-500"
              />

              <select
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as TeamMemberRole })
                }
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-violet-500"
              >
                {roles.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <textarea
                rows={3}
                value={form.observation}
                onChange={(event) =>
                  setForm({ ...form, observation: event.target.value })
                }
                placeholder="Observações"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm outline-none focus:border-violet-500"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 font-black text-zinc-950 disabled:opacity-50"
            >
              <Save size={16} />
              {busy ? 'Salvando...' : 'Salvar integrante'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
      <p className="text-xl font-black text-zinc-100">{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-bold text-zinc-600">
        {label}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center">
      <UserRound size={21} className="mx-auto text-zinc-700" />
      <p className="mt-2 text-xs font-bold text-zinc-600">{text}</p>
    </div>
  );
}
