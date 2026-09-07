// lib/ifood-confirmations.ts
import type { Customer, Delivery } from '@/types';

export type IfoodConfirmationState = 'ready' | 'missing_code' | 'missing_id';
export type IfoodConfirmationCodeSource = 'delivery' | 'customer' | 'none';

export interface IfoodConfirmationInfo {
  state: IfoodConfirmationState;
  ifoodId: string;
  code: string;
  codeSource: IfoodConfirmationCodeSource;
  ready: boolean;
}

export function isIfoodOrder(delivery: Pick<Delivery, 'origin'>): boolean {
  return delivery.origin === 'ifood';
}

export function getIfoodConfirmationInfo(
  delivery: Pick<Delivery, 'origin' | 'ifood_id' | 'confirmation_code'>,
  customer?: Pick<Customer, 'last_confirmation_code'>,
): IfoodConfirmationInfo {
  const ifoodId = (delivery.ifood_id || '').replace(/\D/g, '').slice(0, 8);
  const deliveryCode = (delivery.confirmation_code || '').replace(/\D/g, '').slice(0, 4);
  const customerCode = (customer?.last_confirmation_code || '').replace(/\D/g, '').slice(0, 4);

  const code = deliveryCode || customerCode;
  const codeSource: IfoodConfirmationCodeSource = deliveryCode
    ? 'delivery'
    : customerCode
      ? 'customer'
      : 'none';

  if (ifoodId.length !== 8) {
    return {
      state: 'missing_id',
      ifoodId,
      code,
      codeSource,
      ready: false,
    };
  }

  if (code.length !== 4) {
    return {
      state: 'missing_code',
      ifoodId,
      code,
      codeSource,
      ready: false,
    };
  }

  return {
    state: 'ready',
    ifoodId,
    code,
    codeSource,
    ready: true,
  };
}
