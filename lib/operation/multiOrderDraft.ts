/**
 * Contrato local de rascunhos iFood. Cada número e ID pertence a UM pedido;
 * revisar todas as abas antes de persistir evita parada parcialmente lançada.
 * Não consulta Firebase e não altera a identidade de clientes.
 */
export type MultiOrderDraftIdentity = {
  id: string;
  orderId: string;
  ifoodId: string;
  confirmationCode: string;
  customerCharge: string;
};
export type MultiOrderDraftIssue = {
  id: string;
  kind: 'order_required' | 'duplicate_order' | 'duplicate_ifood_id' | 'invalid_ifood_id' | 'invalid_confirmation' | 'charge_required';
};
export function firstMultiOrderIssue(drafts: readonly MultiOrderDraftIdentity[]): MultiOrderDraftIssue | null {
  const numbers = new Set<string>();
  const ifoodIds = new Set<string>();
  for (const draft of drafts) {
    const number = draft.orderId.trim();
    const ifoodId = draft.ifoodId.trim();
    const confirmation = draft.confirmationCode.trim();
    if (!number) return {id:draft.id,kind:'order_required'};
    if (numbers.has(number)) return {id:draft.id,kind:'duplicate_order'};
    numbers.add(number);
    if (ifoodId && !/^\d{8}$/.test(ifoodId)) return {id:draft.id,kind:'invalid_ifood_id'};
    if (ifoodId && ifoodIds.has(ifoodId)) return {id:draft.id,kind:'duplicate_ifood_id'};
    if (ifoodId) ifoodIds.add(ifoodId);
    if (confirmation && !/^\d{4}$/.test(confirmation)) return {id:draft.id,kind:'invalid_confirmation'};
    if (!draft.customerCharge.trim()) return {id:draft.id,kind:'charge_required'};
  }
  return null;
}
