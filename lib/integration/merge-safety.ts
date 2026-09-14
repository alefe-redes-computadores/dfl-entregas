// lib/integration/merge-safety.ts
import type { ExternalIdentityLink } from './contracts';

export interface CustomerMergeIdentityPlan {
  linksToMove: ExternalIdentityLink[];
}

/**
 * Planeja a transferência de identidades externas durante merge.
 *
 * Não é ligado ao mergeCustomers client-side nesta V19B porque
 * as rules reais das collections integration_* não estão
 * versionadas/auditadas neste repositório.
 *
 * O boundary privilegiado futuro deve obter os links que apontam
 * para sourceCustomerId, movê-los para targetCustomerId na MESMA
 * transação do merge e rejeitar qualquer conflito.
 */
export function planCustomerExternalIdentityMerge(
  sourceCustomerId: string,
  targetCustomerId: string,
  links: ExternalIdentityLink[],
): CustomerMergeIdentityPlan {
  if (!sourceCustomerId || !targetCustomerId) {
    throw new Error('Customer IDs obrigatórios para merge.');
  }

  if (sourceCustomerId === targetCustomerId) {
    throw new Error('Merge exige Customers diferentes.');
  }

  const sourceLinks = links.filter(
    (link) =>
      link.local_entity_type === 'customer' &&
      link.local_entity_id === sourceCustomerId,
  );

  const conflicts = sourceLinks.filter((sourceLink) =>
    links.some(
      (candidate) =>
        candidate.id === sourceLink.id &&
        candidate.local_entity_type === 'customer' &&
        candidate.local_entity_id !== sourceCustomerId &&
        candidate.local_entity_id !== targetCustomerId,
    ),
  );

  if (conflicts.length) {
    throw new Error(
      'Conflito de identidade externa impede merge automático.',
    );
  }

  return {
    linksToMove: sourceLinks.map((link) => ({
      ...link,
      local_entity_id: targetCustomerId,
      updated_at: new Date().toISOString(),
    })),
  };
}
