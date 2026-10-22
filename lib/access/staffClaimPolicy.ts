/** R41: only verified Firebase identities invited by the owner can request a link. */
import { isIsolatedStaffOrigin } from './staffOrigin';
import { isSuperadminUid, type StaffRole } from './roles';
import { requiresMotoboyBinding, validMotoboyBinding } from './staffInvitePolicy';

const SAFE_ID = /^[A-Za-z0-9_-]{8,120}$/;
export type ClaimDraft = {
  id: string;
  email?: unknown;
  status?: unknown;
  activation?: unknown;
  role?: unknown;
  linkedMotoboyId?: unknown;
  permissions?: unknown;
};
export function claimableDraft(value: ClaimDraft, verifiedEmail: string): boolean {
  if (!SAFE_ID.test(value.id) || value.status !== 'rascunho' || value.activation !== 'not_enabled') return false;
  if (!['motoboy', 'compras', 'operacao', 'personalizado'].includes(String(value.role as StaffRole))) return false;
  if (requiresMotoboyBinding(value.role as StaffRole, value.permissions) && !validMotoboyBinding(value.linkedMotoboyId)) return false;
  return typeof value.email === 'string' && value.email.trim().toLowerCase() === verifiedEmail.trim().toLowerCase();
}
export function claimableIdentity(uid: string, email: string | null | undefined, emailVerified: boolean, disabled: boolean): boolean {
  return !isSuperadminUid(uid) && SAFE_ID.test(uid) && !disabled && emailVerified &&
    typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}
export function claimOriginAllowed(origin: string, requestOrigin: string): boolean {
  // Require exact HTTPS staff origin, never owner origin or a native/WebView origin.
  return !!origin && origin === requestOrigin && isIsolatedStaffOrigin(origin);
}
