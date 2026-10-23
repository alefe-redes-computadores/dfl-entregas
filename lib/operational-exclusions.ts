// lib/operational-exclusions.ts
import type { Customer, Motoboy, Route } from '@/types';
import { isOperationalCustomer } from '@/lib/customer-analytics';
import { verifiedInternalMotoboy } from '@/lib/internal-owner-identity';

function normalize(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

/**
 * Perfil interno preservado no domínio administrativo (Equipe/Compras/Estoque),
 * mas excluído das amostras de cliente, motoboy, inteligência logística e acerto.
 */
export function isInternalOperationalCustomer(customer?: Customer | null): boolean {
  return Boolean(customer && isOperationalCustomer(customer));
}

export function isInternalOperationalMotoboy(motoboy?: Motoboy | null): boolean {
  return verifiedInternalMotoboy(motoboy);
}

export function isInternalOperationalRoute(
  route: Route,
  motoboys: Motoboy[] = [],
): boolean {
  const linked =
    (route.motoboy_id
      ? motoboys.find((motoboy) => motoboy.id === route.motoboy_id)
      : undefined) ||
    motoboys.find(
      (motoboy) =>
        normalize(motoboy.name) === normalize(route.motoboy_name),
    );

  if (linked && isInternalOperationalMotoboy(linked)) return true;

  // A route with only a motoboy_name never proves internal ownership.
  return false;
}
