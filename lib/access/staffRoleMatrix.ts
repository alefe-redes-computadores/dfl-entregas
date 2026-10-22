/** R42: plano de visualizacao para o proprietario. NAO e token, login ou autorizacao. */
import { sanitizePermissions, type AccessPermission, type StaffRole } from './roles';
import { STAFF_AREAS, STAFF_SECTION_LABEL, mayReadStaffArea, type StaffAccount, type StaffArea } from './staffRuntime';

export interface StaffAccessPlan {
  visible: StaffArea[];
  restricted: StaffArea[];
  requests: ('delivery_confirmation' | 'purchase_intent')[];
  notes: string[];
  configured: AccessPermission[];
  effective: AccessPermission[];
}
const sensitive = new Set<AccessPermission>(['staff_admin', 'finance', 'settings', 'diagnostics', 'reports']);
export function planStaffAccess(role: StaffRole, permissions: unknown, linkedMotoboyId?: string): StaffAccessPlan {
  const configured = sanitizePermissions(permissions);
  // A visualizacao é mais conservadora que o cadastro; privilégios administrativos
  // não podem ser herdados pelo portal compartilhado, independentemente do papel.
  const effective = configured.filter(permission => !sensitive.has(permission));
  const account: StaffAccount = {
    uid: 'r42_preview_only', displayName: 'Prévia', status: 'active', role,
    permissions: effective, ...(linkedMotoboyId?.trim() ? {linkedMotoboyId:linkedMotoboyId.trim()} : {}),
  };
  const visible = STAFF_AREAS.filter(area => mayReadStaffArea(account,area));
  const restricted = STAFF_AREAS.filter(area => !visible.includes(area));
  const requests: StaffAccessPlan['requests'] = [];
  if (visible.includes('deliveries') && effective.includes('deliveries_complete') && (role === 'operacao' || !!linkedMotoboyId?.trim())) requests.push('delivery_confirmation');
  if (visible.includes('stock') && effective.includes('purchases_write') && role !== 'motoboy') requests.push('purchase_intent');
  const notes: string[] = [];
  if (role === 'motoboy' && !linkedMotoboyId?.trim()) notes.push('Selecione um motoboy para liberar a prévia de Rotas e Entregas.');
  if (role === 'personalizado' && (effective.includes('routes_read') || effective.includes('deliveries_read')) && !linkedMotoboyId?.trim()) notes.push('Logística personalizada exige um motoboy vinculado para limitar o acesso.');
  if (configured.some(permission => sensitive.has(permission))) notes.push('Financeiro, gestão e diagnósticos não são disponibilizados no portal da equipe.');
  if (effective.includes('deliveries_complete')) notes.push('Conferir entregas no portal apenas envia uma solicitação para revisão: NÃO conclui o pedido automaticamente.');
  if (effective.includes('stock_write')) notes.push('Alterar estoque ainda NÃO executa baixas: permissão preparada, sem operação de escrita liberada.');
  if (effective.includes('purchases_write')) notes.push('Registrar compras gera apenas uma solicitação para conferência; não registra compra nem altera estoque.');
  if (effective.includes('routes_create') || effective.includes('deliveries_create')) notes.push('Cadastro operacional ainda não está liberado no portal da equipe.');
  notes.push('Prévia de preparação: publicar Rules e ativar contas exige homologação e autorização separadas.');
  return {visible,restricted,requests,notes,configured,effective};
}
export { STAFF_SECTION_LABEL };
