/** DFL V111 R21: perfis em preparacao; nao autorizam acesso ao Firebase por si so. */
export const DFL_SUPERADMIN_UID = 'zIfbMxD1SQNvtlX9y6YUsEz2TXC3' as const;
export const isSuperadminUid = (uid: string | null | undefined): boolean => uid === DFL_SUPERADMIN_UID;

export const ACCESS_AREAS = [
  { id: 'home', label: 'Inicio', description: 'Resumo operacional autorizado', group: 'Geral' },
  { id: 'routes_read', label: 'Consultar rotas', description: 'Rotas atribuidas, sem dados sigilosos', group: 'Logistica' },
  { id: 'routes_create', label: 'Criar rotas', description: 'Cadastro de rotas', group: 'Logistica' },
  { id: 'deliveries_read', label: 'Consultar entregas', description: 'Entregas sob responsabilidade', group: 'Logistica' },
  { id: 'deliveries_create', label: 'Cadastrar entregas', description: 'Inclusao de novas entregas', group: 'Logistica' },
  { id: 'deliveries_complete', label: 'Finalizar entregas', description: 'Registro de conclusao', group: 'Logistica' },
  { id: 'stock_read', label: 'Consultar estoque', description: 'Produtos e saldos', group: 'Loja' },
  { id: 'stock_write', label: 'Alterar estoque', description: 'Movimentacoes e contagens', group: 'Loja' },
  { id: 'purchases_read', label: 'Consultar compras', description: 'Lista e historico autorizado', group: 'Loja' },
  { id: 'purchases_write', label: 'Registrar compras', description: 'Lancamentos e recebimentos', group: 'Loja' },
  { id: 'reports', label: 'Relatorios', description: 'Indicadores operacionais', group: 'Gestao' },
  { id: 'finance', label: 'Financeiro', description: 'Valores, acertos e despesas', group: 'Gestao' },
  { id: 'settings', label: 'Configuracoes', description: 'Preferencias administrativas', group: 'Gestao' },
  { id: 'diagnostics', label: 'Diagnosticos', description: 'Ferramentas tecnicas', group: 'Gestao' },
  { id: 'staff_admin', label: 'Gerenciar acessos', description: 'Cadastro e autorizacao de contas', group: 'Gestao' },
] as const;
export type AccessPermission = (typeof ACCESS_AREAS)[number]['id'];
export type StaffRole = 'motoboy' | 'compras' | 'operacao' | 'personalizado';
export type StaffStatus = 'rascunho' | 'suspenso';
export const STAFF_ROLES: { id: StaffRole; label: string; subtitle: string }[] = [
  { id: 'motoboy', label: 'Motoboy', subtitle: 'Minhas rotas e entregas' },
  { id: 'compras', label: 'Compras', subtitle: 'Estoque e aquisicoes' },
  { id: 'operacao', label: 'Operacao', subtitle: 'Logistica e loja, sem financeiro' },
  { id: 'personalizado', label: 'Personalizado', subtitle: 'Escolha individual de permissoes' },
];
const rolePermissions: Record<StaffRole, AccessPermission[]> = {
  motoboy: ['home', 'routes_read', 'deliveries_read', 'deliveries_complete'],
  compras: ['home', 'stock_read', 'purchases_read', 'purchases_write'],
  operacao: ['home', 'routes_read', 'routes_create', 'deliveries_read', 'deliveries_create', 'deliveries_complete', 'stock_read', 'purchases_read'],
  personalizado: ['home'],
};
const valid = new Set<string>(ACCESS_AREAS.map((area) => area.id));
export function permissionsForRole(role: StaffRole): AccessPermission[] {
  return [...rolePermissions[role]];
}
export function sanitizePermissions(values: unknown): AccessPermission[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((p): p is AccessPermission => typeof p === 'string' && valid.has(p)))];
}
/** R126 E2: nenhum rascunho de perfil fixo armazena poderes fora do papel. Nao habilita login. */
export function restrictStaffDraftPermissions(role: StaffRole, values: unknown): AccessPermission[] {
  const requested = sanitizePermissions(values);
  if (!Object.prototype.hasOwnProperty.call(rolePermissions, role)) return [];
  const allowed = role === 'personalizado'
    ? new Set<AccessPermission>(ACCESS_AREAS.map(area => area.id).filter(id => id !== 'staff_admin'))
    : new Set<AccessPermission>(rolePermissions[role]);
  return requested.filter(permission => allowed.has(permission));
}
export function roleLabel(role: StaffRole): string {
  return STAFF_ROLES.find((item) => item.id === role)?.label || 'Personalizado';
}
export interface StaffAccessDraft {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: AccessPermission[];
  status: StaffStatus;
  linkedMotoboyId?: string;
  linkedMemberId?: string;
  createdAt: string;
  updatedAt: string;
  updatedByUid: string;
  /** Nao representa vinculo de login nem concede acesso ao Firebase. */
  activation: 'not_enabled';
}
