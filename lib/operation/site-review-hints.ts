/** R299 P6 — Pistas explicáveis para conferência HUMANA, sem nota de risco,
 * blacklist, alteração de status, bloqueio de despacho ou consulta à rede.
 */
import type { Delivery } from '@/types';
import { canonicalSitePhone } from '@/lib/integration/site-guest-identity';

export type SiteReviewHint = { key: 'phone' | 'address' | 'late-cash'; label: string };

export function siteReviewHints(delivery: Pick<Delivery,
  'phone' | 'address_string' | 'customer_charge' | 'value' | 'payment_method' | 'created_at' | 'createdAt'>): SiteReviewHint[] {
  const hints: SiteReviewHint[] = [];
  if (!canonicalSitePhone(delivery.phone))
    hints.push({ key:'phone', label:'Telefone não confirmado: confira um contato válido antes de sair.' });
  const address = String(delivery.address_string || '').trim();
  // A falta de marcador de número não é prova de endereço incorreto.
  const explicitZero = /\b(?:n(?:º|o|umero)?\.?\s*[:.]?\s*0|n[úu]mero\s*0)\b/i.test(address) || /,\s*0(?:\s|,|$)/.test(address);
  if (!address || explicitZero)
    hints.push({ key:'address', label: explicitZero ? 'Número do imóvel 0: confirmar endereço antes da rota.' : 'Endereço ausente: conferir antes da rota.' });
  const timestamp = Date.parse(String(delivery.created_at || delivery.createdAt || ''));
  if (Number.isFinite(timestamp)) {
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone:'America/Sao_Paulo', hour:'2-digit', hour12:false,
    }).format(new Date(timestamp)));
    const value = delivery.customer_charge ?? delivery.value ?? 0;
    if (hour >= 22 && value >= 500 && delivery.payment_method === 'dinheiro' && hints.length)
      hints.push({ key:'late-cash', label:'Pedido alto em dinheiro no período noturno com cadastro incompleto: revisão humana recomendada.' });
  }
  return hints;
}

export function sitePreparationReminder(
  delivery: Pick<Delivery, 'scheduled_for' | 'completed'>,
  now: number,
  leadMinutes: 15 | 30 | 60 = 30,
): { minutes: number; label: string } | null {
  if (delivery.completed || !delivery.scheduled_for) return null;
  const timestamp = Date.parse(delivery.scheduled_for);
  if (!Number.isFinite(timestamp)) return null;
  const remaining = Math.ceil((timestamp - now) / 60_000);
  if (remaining > leadMinutes || remaining < -60) return null;
  return {
    minutes: remaining,
    label: remaining > 0 ? `Preparação em até ${remaining} min · conferir no Site`
      : 'Horário previsto alcançado · conferir preparo no Site',
  };
}
