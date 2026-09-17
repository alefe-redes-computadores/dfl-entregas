// lib/operational-exclusions.ts
import type { Customer, Motoboy, Route } from '@/types';
import { isOperationalCustomer } from '@/lib/customer-analytics';

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
  if (!motoboy) return false;
  const name = normalize(motoboy.name);
  return name === 'alefe' ||
    name === 'alefe johsefe' ||
    name === 'alefe johsefe de brito gomes';
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

  const routeName = normalize(route.motoboy_name);
  return routeName === 'alefe' ||
    routeName === 'alefe johsefe' ||
    routeName === 'alefe johsefe de brito gomes';
}
