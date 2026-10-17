import type { IfoodPendingConfirmation } from '@/types';

/** O estado resolvido no Firestore tem prioridade absoluta na geração da fila. */
export function reconcileIfoodConfirmation(
  remote: IfoodPendingConfirmation | undefined,
  incoming: IfoodPendingConfirmation,
): IfoodPendingConfirmation {
  if (!remote) return incoming;
  if (remote.status === 'resolved') return { ...remote, id: remote.id || incoming.id };
  return {
    ...remote,
    ...incoming,
    id: remote.id,
    status: remote.status || 'pending',
    created_at: remote.created_at || incoming.created_at,
    resolved_at: remote.resolved_at,
  };
}
