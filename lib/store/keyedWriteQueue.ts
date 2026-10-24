/**
 * R93 — fila local por documento, sem listener, retry automático ou consulta extra.
 *
 * Atualizações distintas do mesmo documento devem chegar ao Firestore na ordem
 * em que foram disparadas. Outros documentos não aguardam uns pelos outros.
 *
 * O erro pertence à operação que falhou; a fila posterior continua. Isso não
 * substitui transações, autoridade do servidor ou coordenação entre aparelhos.
 */
export function createKeyedWriteQueue() {
  const tails = new Map<string, Promise<void>>();

  return function queueKeyedWrite<T>(
    collectionName: string,
    documentId: string,
    persist: () => Promise<T>,
  ): Promise<T> {
    if (!collectionName.trim() || !documentId.trim()) {
      return Promise.reject(new Error('R93: documento de gravação não identificado.'));
    }

    // O separador evita colisões entre pares de coleção/id diferentes.
    const key = `${collectionName.length}:${collectionName}${documentId.length}:${documentId}`;
    const previous = tails.get(key) || Promise.resolve();
    const operation = previous.then(persist);
    const settled = operation.then(() => undefined, () => undefined);
    tails.set(key, settled);

    // A Promise de retorno preserva a falha original para rollback e feedback.
    return operation.finally(() => {
      // Uma escrita mais nova pode já estar na fila: não remover seu tail.
      if (tails.get(key) === settled) tails.delete(key);
    });
  };
}
