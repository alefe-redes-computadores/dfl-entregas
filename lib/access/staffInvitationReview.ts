/** R44 — conferencia preventiva do convite. Pura, sem acesso ao Firebase.
 * "pronto para homologar" NAO equivale a conta ativa ou permissão publicada.
 */
import { sanitizePermissions, type StaffRole } from './roles';
import { requiresMotoboyBinding, validMotoboyBinding } from './staffInvitePolicy';
const ROLES: StaffRole[] = ['motoboy', 'compras', 'operacao', 'personalizado'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIVATE = new Set(['staff_admin', 'finance', 'settings', 'diagnostics', 'reports']);
const DELIVERY = new Set(['routes_read', 'routes_create', 'deliveries_read', 'deliveries_create', 'deliveries_complete']);
const PURCHASE = new Set(['stock_read', 'stock_write', 'purchases_read', 'purchases_write']);
export type StaffInvitationInput = {
  name: unknown; email: unknown; role: unknown; permissions: unknown;
  linkedMotoboyId?: unknown; activation?: unknown; status?: unknown;
};
export function reviewStaffInvitation(value: StaffInvitationInput): {readyForHomologation:boolean; issues:string[]; forbidden:string[]} {
  const issues:string[]=[];
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const role = ROLES.includes(value.role as StaffRole) ? value.role as StaffRole : null;
  const configured = sanitizePermissions(value.permissions);
  const raw = Array.isArray(value.permissions) ? value.permissions : [];
  const forbidden = configured.filter(permission => PRIVATE.has(permission));
  if(name.length<2||name.length>120) issues.push('Informe um nome válido para identificar o funcionário.');
  if(!email||email.length>160||!EMAIL.test(email)) issues.push('Informe o e-mail Google usado pela pessoa no login.');
  if(!role) issues.push('Selecione um perfil operacional válido.');
  if(!Array.isArray(value.permissions)||raw.length!==configured.length) issues.push('Revise as permissões duplicadas ou desconhecidas.');
  if(forbidden.length) issues.push('Remova permissões de gestão/financeiro: indisponíveis no portal da equipe.');
  if(!configured.includes('home')) issues.push('Habilite Início para o painel individual.');
  if(role === 'motoboy' && configured.some(p => PURCHASE.has(p))) issues.push('Motoboy não pode receber Estoque ou Compras.');
  if(role === 'compras' && configured.some(p => DELIVERY.has(p))) issues.push('Compras não pode receber Rotas ou Entregas.');
  if(role && requiresMotoboyBinding(role,value.permissions) && !validMotoboyBinding(value.linkedMotoboyId)) issues.push('Selecione um motoboy vinculado para a logística individual.');
  if(value.activation !== undefined && value.activation !== 'not_enabled') issues.push('A ativação não pode ser feita por um rascunho.');
  if(value.status !== undefined && value.status !== 'rascunho') issues.push('Somente cadastros em rascunho podem ser homologados.');
  return {readyForHomologation:issues.length===0, issues, forbidden};
}
