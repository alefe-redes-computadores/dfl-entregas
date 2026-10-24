/**
 * R94 — reserva TODAS as chaves do lote na fila R93 antes de esperar rede.
 * Um setDoc/updateDoc posterior não pode ultrapassar um batch já enfileirado
 * só porque o batch estava aguardando outra entrega.
 *
 * Não substitui a atomicidade do Firestore nem resolve concorrência entre
 * aparelhos; a reserva é apenas para esta instância de JavaScript.
 */
export function queueDeliveryDocuments<T>(
  queue: <R>(collectionName: string, documentId: string, persist: () => Promise<R>) => Promise<R>,
  deliveryIds: readonly string[],
  persist: () => Promise<T>,
): Promise<T> {
  const ids = [...new Set(deliveryIds)];
  if (!ids.length) return persist(); // rota vazia conserva comportamento legado.
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) {
    return Promise.reject(new Error('R94: lote sem IDs válidos de pedidos.'));
  }
  ids.sort(); // rastreio determinístico e depuração consistente.

  let release!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const acquired = ids.map(() => {
    let mark!: () => void;
    const promise = new Promise<void>((resolve) => { mark = resolve; });
    return { promise, mark };
  });

  // Reservar TODAS as chaves sincronicamente evita inversão com uma baixa
  // individual disparada logo depois do batch. As operações apenas seguram
  // sua posição; o commit real só começa após todas estarem adquiridas.
  const reservations = ids.map((id, index) => queue('deliveries', id, async () => {
    acquired[index].mark();
    await released;
  }));

  return Promise.all(acquired.map((item) => item.promise))
    .then(persist)
    .finally(async () => {
      release();
      await Promise.all(reservations);
    });
}
