/**
 * R230 — diário METADATA-ONLY de operações que aguardam confirmação Firestore.
 * NÃO é fila de replay, não salva pedidos, IDs comerciais, cliente, endereço, valor
 * nem credenciais. Uma operação pendente após reinício é NÃO VERIFICADA, jamais
 * 'confirmada' ou automaticamente repetida.
 */
export type WriteKind = 'delivery' | 'route_order' | 'purchase' | 'stock_movement' | 'stock_integration';
export type WriteStatus = 'pending' | 'confirmed' | 'failed' | 'unverified' | 'reviewed';
export type WriteReceipt = { token: string; kind: WriteKind; status: WriteStatus; at: string; finishedAt?: string };
export const WRITE_JOURNAL_EVENT = 'dfl:operational-write-journal';
const PREFIX = 'dfl-write-journal-v230:';
const MAX_ENTRIES = 40;
const MAX_AGE_MS = 7 * 86400_000;
const KINDS: readonly WriteKind[] = ['delivery','route_order','purchase','stock_movement','stock_integration'];
const STATUSES: readonly WriteStatus[] = ['pending','confirmed','failed','unverified','reviewed'];
const live = new Set<string>();
let serial = 0;
const nowIso = () => new Date().toISOString();
const validTime = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

// UID nunca vai para o diário nem é persistido em texto. Nome da chave isolado por conta.
function storageKey(owner: string | undefined): string | null {
  if (!owner || owner.length > 256) return null;
  let hash = 2166136261;
  for (let i = 0; i < owner.length; i++) hash = Math.imul(hash ^ owner.charCodeAt(i), 16777619);
  return PREFIX + (hash >>> 0).toString(16).padStart(8, '0');
}

export function sanitizeWriteJournal(raw: unknown, now = Date.now()): WriteReceipt[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: WriteReceipt[] = [];
  for (const candidate of raw.slice(0, MAX_ENTRIES * 3)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const x = candidate as Record<string, unknown>;
    if (typeof x.token !== 'string' || !/^w[0-9a-z-]{5,65}$/.test(x.token) || seen.has(x.token)) continue;
    if (!KINDS.includes(x.kind as WriteKind) || !STATUSES.includes(x.status as WriteStatus) || !validTime(x.at)) continue;
    const age = now - Date.parse(x.at as string);
    if (age < -60_000 || age > MAX_AGE_MS) continue;
    const pending = x.status === 'pending';
    const entry: WriteReceipt = {
      token: x.token,
      kind: x.kind as WriteKind,
      status: pending && !live.has(x.token) ? 'unverified' : x.status as WriteStatus,
      at: x.at as string,
    };
    if (validTime(x.finishedAt)) entry.finishedAt = x.finishedAt as string;
    result.push(entry);
    seen.add(entry.token);
    if (result.length === MAX_ENTRIES) break;
  }
  return result;
}

export function readWriteJournal(owner: string | undefined): WriteReceipt[] {
  const key = storageKey(owner);
  if (!key || typeof window === 'undefined') return [];
  try { return sanitizeWriteJournal(JSON.parse(window.localStorage.getItem(key) || '[]')); }
  catch { return []; }
}

function save(owner: string | undefined, entries: WriteReceipt[]): void {
  const key = storageKey(owner);
  if (!key || typeof window === 'undefined') return;
  try {
    // Não persistir o estado interpretado da sessão anterior sem preservá-lo.
    window.localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new Event(WRITE_JOURNAL_EVENT));
  } catch { /* Diagnóstico nunca interrompe uma gravação operacional. */ }
}

export function beginOperationalWrite(kind: WriteKind, owner: string | undefined): string | null {
  if (!KINDS.includes(kind) || !storageKey(owner) || typeof window === 'undefined') return null;
  const token = `w${Date.now().toString(36)}-${(++serial).toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  live.add(token);
  save(owner, [{ token, kind, status: 'pending', at: nowIso() }, ...readWriteJournal(owner)]);
  return token;
}

export function finishOperationalWrite(owner: string | undefined, token: string | null, status: 'confirmed' | 'failed'): void {
  if (!token) return;
  const items = readWriteJournal(owner);
  // Se o diagnóstico foi limpo durante a operação, não criar registro fictício.
  const next = items.map((entry) => entry.token === token
    ? { ...entry, status, finishedAt: nowIso() } : entry);
  live.delete(token);
  if (next.some((entry) => entry.token === token)) save(owner, next);
}

/** Envolve APENAS a confirmação real da promise. Não engole erro, não repete. */
export async function observeOperationalWrite<T>(kind: WriteKind, owner: string | undefined, persist: () => Promise<T>): Promise<T> {
  const receipt = beginOperationalWrite(kind, owner);
  try {
    const result = await persist();
    finishOperationalWrite(owner, receipt, 'confirmed');
    return result;
  } catch (error) {
    finishOperationalWrite(owner, receipt, 'failed');
    throw error;
  }
}

export function writeJournalSummary(entries: readonly WriteReceipt[]) {
  return {
    pending: entries.filter(x => x.status === 'pending').length,
    unverified: entries.filter(x => x.status === 'unverified').length,
    failed: entries.filter(x => x.status === 'failed').length,
    confirmed: entries.filter(x => x.status === 'confirmed').length,
  };
}

/** Depois de CONFERIR manualmente o histórico, apenas reconhece aviso — não grava no servidor. */
export function acknowledgeUnverifiedWrites(owner: string | undefined): number {
  const entries = readWriteJournal(owner);
  const affected = entries.filter(entry => entry.status === 'unverified').length;
  if (affected) save(owner, entries.map(entry => entry.status === 'unverified' ? { ...entry, status: 'reviewed' } : entry));
  return affected;
}
