/** R47 — O(n) merge of incremental snapshots, preserving server precedence.
 * This only optimizes the in-memory reconciliation; it never issues writes/reads. */
export function mergeCloudFirstById<T extends { id: string }>(
  cloud: readonly T[], local: readonly T[],
): T[] {
  const merged = [...cloud];
  const known = new Set(cloud.map((item) => item.id));
  for (const item of local) {
    if (known.has(item.id)) continue;
    known.add(item.id);
    merged.push(item);
  }
  return merged;
}

/** Keep expansion state on matching deliveries, without allowing local fields to overwrite server data. */
export function mergeDeliveriesPreservingExpansion<T extends { id: string; is_expanded?: boolean }>(
  cloud: readonly T[], local: readonly T[],
): T[] {
  const localById = new Map(local.map((item) => [item.id, item] as const));
  const merged: T[] = cloud.map((item) => {
    const localItem = localById.get(item.id);
    return { ...item, is_expanded: localItem ? localItem.is_expanded : false } as T;
  });
  const known = new Set(merged.map((item) => item.id));
  for (const item of local) {
    if (known.has(item.id)) continue;
    known.add(item.id);
    merged.push(item);
  }
  return merged;
}
