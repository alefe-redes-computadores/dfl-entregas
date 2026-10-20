/** A última rota aberta é APENAS preferência visual, nunca fonte de operações. */
const LAST_OPEN_ROUTE = 'dfl-route-last-open-v2';
const ACTIVE_ROUTE = 'dfl-active-operational-route-v1';

export function readRememberedRouteId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.localStorage.getItem(LAST_OPEN_ROUTE);
    return id && id.length <= 160 ? id : null;
  } catch {
    // Android bloqueando Storage não pode impedir abrir as rotas.
    return null;
  }
}

export function readActiveOperationalRouteId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.localStorage.getItem(ACTIVE_ROUTE);
    return id && id.length <= 160 ? id : null;
  } catch { return null; }
}

export function rememberActiveOperationalRouteId(id: string): void {
  if (typeof window === 'undefined' || !id || id.length > 160) return;
  try { window.localStorage.setItem(ACTIVE_ROUTE, id); } catch { /* best effort */ }
}

export function rememberOpenRouteId(id: string): void {
  if (typeof window === 'undefined' || !id || id.length > 160) return;
  // Cada tentativa independente: falhar um valor nunca impede o outro.
  for (const key of [LAST_OPEN_ROUTE, ACTIVE_ROUTE]) {
    try { window.localStorage.setItem(key, id); } catch { /* best effort */ }
  }
}
