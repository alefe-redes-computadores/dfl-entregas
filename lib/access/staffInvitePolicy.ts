/** R43 — requisito estrutural do convite. Não concede permissão ou acesso. */
import type { StaffRole } from './roles';
const LOGISTICS = new Set(['routes_read', 'deliveries_read', 'routes_create', 'deliveries_create', 'deliveries_complete']);
export function requiresMotoboyBinding(role: StaffRole, permissions: unknown): boolean {
  return role === 'motoboy' || (role === 'personalizado' && Array.isArray(permissions) && permissions.some(p => typeof p === 'string' && LOGISTICS.has(p)));
}
export function validMotoboyBinding(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 120 && value.trim().length > 0 && !/[\\/\x00-\x1f]/.test(value);
}
