import 'server-only';
import { adminDb } from './admin';
import { INTEGRATION_COLLECTIONS } from '../identity';

/**
 * V19C: guarda para merges executados por boundary privilegiado.
 * O merge client-side legado permanece funcional, mas NÃO deve ser usado para
 * clientes integrados até ser migrado integralmente para este boundary.
 */
export async function customerHasExternalIdentity(customerId: string): Promise<boolean> {
  const snap = await adminDb.collection(INTEGRATION_COLLECTIONS.identities)
    .where('local_entity_type', '==', 'customer')
    .where('local_entity_id', '==', customerId)
    .limit(1)
    .get();
  return !snap.empty;
}
