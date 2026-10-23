import type { Delivery } from '@/types';
import { ownerNameAndPhone } from '@/lib/internal-owner-identity';

export type OwnerOrderContext = NonNullable<Delivery['owner_order_context']>;

const normalize = (value?: string | null) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const digits = (value?: string | null) => (value || '').replace(/\D/g, '');

export function hasOwnerIdentity(input: { name?: string | null; phone?: string | null }): boolean {
  return ownerNameAndPhone(input.name||undefined,input.phone||undefined);
}

export function ownerContextFlags(context: OwnerOrderContext) {
  return {
    owner_order_context: context,
    developer_test: context === 'owner_test' || undefined,
    exclude_customer_metrics:
      context === 'owner_test' || context === 'owner_provisional' || undefined,
  } satisfies Partial<Delivery>;
}

export function ownerContextLabel(delivery: Delivery): string | null {
  const context = delivery.owner_order_context || (delivery.developer_test ? 'owner_test' : null);
  if (context === 'owner_test') return 'DEV · teste';
  if (context === 'owner_provisional') return 'Cliente a identificar';
  if (context === 'store_pickup') return 'Retirada na loja';
  return null;
}
