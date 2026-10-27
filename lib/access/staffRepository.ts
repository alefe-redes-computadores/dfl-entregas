/** Escritas administrativas de PREPARACAO: regras atuais permitem apenas o superadmin. */
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  isSuperadminUid, sanitizePermissions, restrictStaffDraftPermissions, STAFF_ROLES, type StaffAccessDraft,
} from './roles';
import { requiresMotoboyBinding, validMotoboyBinding } from './staffInvitePolicy';

const collectionName = 'staff_access_drafts';
const auditName = 'staff_access_audit';

function ensureOwner() {
  const uid = auth.currentUser?.uid;
  if (!isSuperadminUid(uid)) throw new Error('Somente o superadministrador pode gerenciar acessos.');
  return uid!;
}

export async function loadStaffDrafts(): Promise<StaffAccessDraft[]> {
  ensureOwner();
  const response = await getDocs(collection(db, collectionName));
  return response.docs.map((item) => ({ ...item.data(), id: item.id } as StaffAccessDraft))
    .filter((item) => item.activation === 'not_enabled')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function saveStaffDraft(record: StaffAccessDraft, reason: 'create' | 'update' | 'suspend' | 'resume'): Promise<void> {
  const uid = ensureOwner();
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(record.id)) throw new Error('Identificador invalido.');
  if (record.name.trim().length < 2 || record.name.length > 120) throw new Error('Informe um nome valido.');
  if (record.email.length > 160 || (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email.trim()))) throw new Error('E-mail invalido.');
  if (!STAFF_ROLES.some((item) => item.id === record.role)) throw new Error('Perfil de acesso invalido.');
  if (record.permissions !== undefined && !Array.isArray(record.permissions)) throw new Error('Permissoes invalidas.');
  const { linkedMotoboyId, linkedMemberId } = record;
  if (linkedMotoboyId && !validMotoboyBinding(linkedMotoboyId)) throw new Error('Vinculo do motoboy invalido.');
  if (linkedMemberId && !validMotoboyBinding(linkedMemberId)) throw new Error('Vinculo do integrante invalido.');
  if (requiresMotoboyBinding(record.role, record.permissions) && linkedMotoboyId && !validMotoboyBinding(linkedMotoboyId)) throw new Error('Vinculo de logistica invalido.');
  if (record.activation !== 'not_enabled') throw new Error('Ativacao de funcionarios ainda nao disponivel.');
  if (!['rascunho', 'suspenso'].includes(record.status)) throw new Error('Status invalido.');
  const now = new Date().toISOString();
  const { linkedMotoboyId: ignoredMotoboyId, linkedMemberId: ignoredMemberId, ...base } = record;
  const safe: StaffAccessDraft = {
    ...base,
    name: record.name.trim(),
    email: record.email.trim().toLowerCase(),
    permissions: restrictStaffDraftPermissions(record.role, sanitizePermissions(record.permissions)).filter((permission) => permission !== 'staff_admin'),
    ...(linkedMotoboyId ? { linkedMotoboyId } : {}),
    ...(linkedMemberId ? { linkedMemberId } : {}),
    updatedAt: now,
    updatedByUid: uid,
    activation: 'not_enabled',
  };
  const batch = writeBatch(db);
  batch.set(doc(db, collectionName, safe.id), safe);
  batch.set(doc(collection(db, auditName)), {
    targetId: safe.id,
    action: reason,
    actorUid: uid,
    occurredAt: now,
    role: safe.role,
    status: safe.status,
    permissions: safe.permissions,
    // Nao copiar nome/email para a trilha de auditoria.
  });
  await batch.commit();
}
