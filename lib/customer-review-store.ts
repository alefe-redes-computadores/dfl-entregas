/** Transação owner-only; nunca usa um update otimista não confirmado. */
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isSuperadminUid } from '@/lib/access/roles';
import { appendCustomerReview } from '@/lib/customer-review';
import type { Customer, CustomerReviewState, CustomerOperationalReview } from '@/types';

export async function recordCustomerReview(input: {
  customerId: string; state: CustomerReviewState; reason: string;
  relatedDeliveryId?: string;
}): Promise<CustomerOperationalReview> {
  const actor = auth.currentUser;
  if (!actor || !isSuperadminUid(actor.uid)) throw new Error('Somente o proprietário pode registrar revisões.');
  if (!input.customerId.trim()) throw new Error('Cliente inválido.');
  const eventId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();
  const ref = doc(db, 'customers', input.customerId);
  return runTransaction(db, async tx => {
    if (auth.currentUser?.uid !== actor.uid) throw new Error('Sessão alterada: operação cancelada.');
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Cliente não encontrado no servidor.');
    const current = snap.data() as Customer;
    const next = appendCustomerReview({
      previous: current.operational_review, state: input.state, reason: input.reason,
      actorUid: actor.uid, eventId, occurredAt, relatedDeliveryId: input.relatedDeliveryId,
    });
    tx.update(ref, { operational_review: next, operational_review_server_at: serverTimestamp() });
    return next;
  });
}
