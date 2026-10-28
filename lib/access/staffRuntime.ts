/** V111 R22: politica estrita da area de funcionarios. Nenhum dado admin e reutilizado. */
import { sanitizePermissions, type AccessPermission } from './roles';

export const STAFF_AREAS = ['home', 'routes', 'deliveries', 'stock', 'purchases'] as const;
export type StaffArea = typeof STAFF_AREAS[number];
export type StaffAccountStatus = 'active' | 'suspended';
export interface StaffAccount {
  uid: string;
  displayName: string;
  status: StaffAccountStatus;
  role: 'motoboy' | 'compras' | 'operacao' | 'personalizado';
  permissions: AccessPermission[];
  linkedMotoboyId?: string;
  linkedMemberId?: string;
  updatedAt?: string;
}

/** Colecoes PROJETADAS, nunca deliveries/routes/stockProducts raiz. */
export const STAFF_AREA_PERMISSION: Record<StaffArea, AccessPermission> = {
  home: 'home',
  routes: 'routes_read',
  deliveries: 'deliveries_read',
  stock: 'stock_read',
  purchases: 'purchases_read',
};
export const STAFF_SECTION_LABEL: Record<StaffArea, string> = {
  home: 'Início', routes: 'Minhas rotas', deliveries: 'Entregas', stock: 'Estoque', purchases: 'Compras',
};

export function parseStaffAccount(value: unknown, uid: string): StaffAccount | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Record<string, unknown>;
  if (x.uid !== uid || !['active', 'suspended'].includes(String(x.status))) return null;
  if (!['motoboy','compras','operacao','personalizado'].includes(String(x.role))) return null;
  if (typeof x.displayName !== 'string' || x.displayName.length > 120) return null;
  return {
    uid, displayName: x.displayName, status: x.status as StaffAccountStatus,
    role: x.role as StaffAccount['role'],
    permissions: sanitizePermissions(x.permissions).filter((p) => p !== 'staff_admin' && p !== 'diagnostics' && p !== 'finance' && p !== 'settings'),
    ...(typeof x.linkedMotoboyId === 'string' ? { linkedMotoboyId: x.linkedMotoboyId } : {}),
    ...(typeof x.linkedMemberId === 'string' ? { linkedMemberId: x.linkedMemberId } : {}),
    ...(typeof x.updatedAt === 'string' ? { updatedAt: x.updatedAt } : {}),
  };
}
export function mayReadStaffArea(account: StaffAccount | null, area: StaffArea): boolean {
  if (!STAFF_AREAS.includes(area)) return false;
  if (!account || account.status !== 'active') return false;
  if (account.role === 'motoboy' && (area === 'stock' || area === 'purchases')) return false;
  if (account.role === 'compras' && (area === 'routes' || area === 'deliveries')) return false;
  if (area === 'routes' || area === 'deliveries') {
    if ((account.role === 'motoboy' || account.role === 'personalizado') && !account.linkedMotoboyId?.trim()) return false;
  }
  return account.permissions.includes(STAFF_AREA_PERMISSION[area]);
}

/** Descricao projetada. NUNCA incluir JSON bruto ou campos financeiros. */
export interface StaffRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  /** Referencia opaca, apenas para uso interno; nao concede escrita. */
  linkId?: string;
}
const text = (v: unknown, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export function decodeStaffRow(value: unknown, id: string): StaffRow {
  const x: Record<string, unknown> = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {id, title: text(x.title, 120) || 'Item sem título', subtitle: text(x.subtitle, 180), status: text(x.status, 32)};
}
