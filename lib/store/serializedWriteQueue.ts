/**
 * Escritas Firestore que substituem um mesmo documento precisam conservar a
 * ordem de invocação. Um setDoc antigo terminando depois do novo pode
 * restaurar horários/abertura já modificados na interface.
 *
 * A fila é local à instância JavaScript; não substitui revisão no servidor
 * nem coordenação entre dispositivos diferentes.
 */
export function createSerializedWriteQueue() {
  let tail: Promise<void> = Promise.resolve();
  return <T>(snapshot: T, persist: (value: T) => Promise<unknown>): Promise<void> => {
    const operation = tail.then(async () => {
      await persist(snapshot);
    });
    // Uma falha precisa chegar ao chamador, sem bloquear as próximas alterações.
    tail = operation.catch(() => undefined);
    return operation;
  };
}
