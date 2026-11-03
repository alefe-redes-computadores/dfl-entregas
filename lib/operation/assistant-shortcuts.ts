/** R236: somente identificadores fixos; nunca registrar nome, telefone, pedido ou busca livre. */
export const ASSISTANT_SHORTCUTS = [
  { id: 'routes-building', title: 'Rotas em montagem', command: 'Rotas em montagem', category: 'rotas' },
  { id: 'routes-street', title: 'Rotas na rua', command: 'Rotas na rua', category: 'rotas' },
  { id: 'deliveries-pending', title: 'Entregas pendentes', command: 'Entregas pendentes', category: 'entregas' },
  { id: 'stock-low', title: 'Estoque baixo', command: 'Produtos abaixo do mínimo', category: 'estoque' },
  { id: 'purchases-open', title: 'Montar compra', command: 'Compras', category: 'compras' },
  { id: 'inbox-open', title: 'Caixa de Entrada', command: 'Caixa de Entrada', category: 'caixa' },
] as const;

export type AssistantShortcutId = (typeof ASSISTANT_SHORTCUTS)[number]['id'];
export type AssistantShortcutsState = { favorites: AssistantShortcutId[]; recent: AssistantShortcutId[] };

export const ASSISTANT_SHORTCUTS_STORAGE_KEY = 'dfl-assistant-shortcuts-v1';
const KNOWN = new Set<string>(ASSISTANT_SHORTCUTS.map(item => item.id));
const LIMIT_FAVORITES = 6;
const LIMIT_RECENT = 4;
export const EMPTY_ASSISTANT_SHORTCUTS: AssistantShortcutsState = { favorites: [], recent: [] };

function safeIds(value: unknown, limit: number): AssistantShortcutId[] {
  if (!Array.isArray(value)) return [];
  const safe: AssistantShortcutId[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !KNOWN.has(item) || safe.includes(item as AssistantShortcutId)) continue;
    safe.push(item as AssistantShortcutId);
    if (safe.length >= limit) break;
  }
  return safe;
}

export function parseAssistantShortcuts(raw: string | null): AssistantShortcutsState {
  if (!raw || raw.length > 2048) return { favorites: [], recent: [] };
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { favorites: [], recent: [] };
    const value = data as { favorites?: unknown; recent?: unknown; version?: unknown };
    if (value.version !== 1) return { favorites: [], recent: [] };
    return { favorites: safeIds(value.favorites, LIMIT_FAVORITES), recent: safeIds(value.recent, LIMIT_RECENT) };
  } catch {
    return { favorites: [], recent: [] };
  }
}

export function serializeAssistantShortcuts(state: AssistantShortcutsState): string {
  return JSON.stringify({ version: 1, favorites: safeIds(state.favorites, LIMIT_FAVORITES), recent: safeIds(state.recent, LIMIT_RECENT) });
}

export function toggleAssistantFavorite(state: AssistantShortcutsState, id: AssistantShortcutId): AssistantShortcutsState {
  if (!KNOWN.has(id)) return state;
  const favorites = state.favorites.includes(id)
    ? state.favorites.filter(item => item !== id)
    : [id, ...state.favorites].slice(0, LIMIT_FAVORITES);
  return { ...state, favorites };
}

export function rememberAssistantShortcut(state: AssistantShortcutsState, id: AssistantShortcutId): AssistantShortcutsState {
  if (!KNOWN.has(id)) return state;
  return { ...state, recent: [id, ...state.recent.filter(item => item !== id)].slice(0, LIMIT_RECENT) };
}

export function assistantShortcutById(id: string) {
  return ASSISTANT_SHORTCUTS.find(item => item.id === id);
}

export function assistantShortcutByCommand(query: string) {
  const normal = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  return ASSISTANT_SHORTCUTS.find(item =>
    item.command.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === normal,
  );
}
