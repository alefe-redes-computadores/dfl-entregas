/** R86: validação operacional — não persiste dados nem lê Firestore. */
export type DeliveryFormField = 'route' | 'address' | 'value' | 'order';
export type DeliveryFormIssue = { field: DeliveryFormField; message: string };

export function firstRequiredDeliveryIssue(input: {
  fulfillmentMode: string;
  routeId: string;
  address: string;
  value: string;
}): DeliveryFormIssue | null {
  if (input.fulfillmentMode === 'delivery' && !input.routeId.trim()) {
    return { field: 'route', message: 'Selecione a rota responsável pela entrega.' };
  }
  if (input.fulfillmentMode === 'delivery' && !input.address.trim()) {
    return { field: 'address', message: 'Informe o endereço da entrega.' };
  }
  if (!input.value.trim()) {
    return { field: 'value', message: 'Informe o valor do pedido.' };
  }
  return null;
}

/** Mantém o gesto no campo, com scroll seguro para telas pequenas/teclado Android. */
export function focusDeliveryIssue(field: DeliveryFormField): void {
  if (typeof document === 'undefined') return;
  const region = document.getElementById(`dfl-delivery-${field}`);
  if (!region) return;
  region.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const target = region.matches('input,button')
    ? region
    : region.querySelector('button, input, textarea, [tabindex]');
  if (target instanceof HTMLElement) target.focus({ preventScroll: true });
}
