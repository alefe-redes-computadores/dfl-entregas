/**
 * R92 — barreira curta entre um getDocs em andamento e mutações locais.
 * A regra de autoridade continua sendo cloud-first fora desta janela.
 * Helpers puros: nenhuma chamada de rede, persistência ou temporizador.
 */
export type SyncRecord = { id: string };

/** Captura os campos operacionais, sem considerar expansão visual do card. */
export function operationalDeliverySignature(value: {
  updated_at?: string; route_id?: string | null; order_index?: number | null;
  completed?: boolean; confirmation_code?: string | null; is_paid?: boolean;
  value?: number; customer_charge?: number; address_string?: string;
  maps_link?: string; payment_method?: string; is_urgent?: boolean;
  stop_group_id?: string; delivery_attempts?: unknown[];
}): string {
  return JSON.stringify([
    value.updated_at, value.route_id, value.order_index, value.completed,
    value.confirmation_code, value.is_paid, value.value, value.customer_charge,
    value.address_string, value.maps_link, value.payment_method,
    value.is_urgent, value.stop_group_id, value.delivery_attempts,
  ]);
}

export function operationalRouteSignature(value: {
  updated_at?: string; name?: string; motoboy_id?: string;
  motoboy_name?: string; status?: string; started_at?: string;
  departure_time?: string; end_time?: string; order_index?: number;
}): string {
  return JSON.stringify([
    value.updated_at, value.name, value.motoboy_id, value.motoboy_name,
    value.status, value.started_at, value.departure_time,
    value.end_time, value.order_index,
  ]);
}

export function captureOperationalBaseline<T extends SyncRecord>(
  items: readonly T[], signature: (item: T) => string,
): Map<string, string> {
  return new Map(items.map(item => [item.id, signature(item)] as const));
}

/**
 * Aplica cloud-first e protege APENAS documentos modificados localmente desde
 * o começo daquela busca. Remoção local durante a busca também é preservada.
 * Não salva nada, não cria entidades e não decide conflitos entre aparelhos.
 */
export function preserveInFlightLocalEdits<T extends SyncRecord>(
  cloudFirstMerged: readonly T[], currentLocal: readonly T[],
  baseline: ReadonlyMap<string, string>, signature: (item: T) => string,
): T[] {
  const current = new Map(currentLocal.map(item => [item.id, item] as const));
  const result: T[] = [];
  for (const remoteOrLocal of cloudFirstMerged) {
    const before = baseline.get(remoteOrLocal.id);
    const existsBefore = baseline.has(remoteOrLocal.id);
    const currentItem = current.get(remoteOrLocal.id);
    // Deletado durante o download: não ressuscitar com snapshot anterior.
    if (existsBefore && !currentItem) continue;
    // Criado ou editado durante o download: mantê-lo até o próximo sync.
    if (currentItem && (!existsBefore || signature(currentItem) !== before)) {
      result.push(currentItem);
    } else {
      result.push(remoteOrLocal);
    }
  }
  return result;
}

/**
 * Um item local com relógio futuro não pode empurrar a consulta Firestore para
 * além do presente. Se não existe checkpoint seguro, o caller faz bootstrap.
 */
export function trustedIncrementalCheckpoint<T>(
  items: readonly T[], timestampOf: (item: T) => string | null | undefined,
  nowMs: number,
): number {
  if (!Number.isFinite(nowMs) || nowMs <= 0) return 0;
  let latest = 0;
  for (const item of items) {
    const stamp = timestampOf(item);
    if (!stamp) continue;
    const parsed = Date.parse(stamp);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= nowMs) {
      latest = Math.max(latest, parsed);
    }
  }
  return latest;
}

/** Abort before merging remote records from another authenticated account. */
export function syncOwnerStillCurrent(startedUid: string | undefined, currentUid: string | undefined): boolean {
  return Boolean(startedUid && startedUid === currentUid);
}
