import type { Delivery } from '@/types';
import type { ParsedIfoodOrder } from '@/lib/ifood-order-parser';
import { assessIfoodParseQuality } from '@/lib/ifood-parser-quality';

export type DeliveryInboxSource = 'ifood' | 'whatsapp' | 'texto';
export type DeliveryInboxStatus =
  | 'review'
  | 'ready'
  | 'launching'
  | 'launched'
  | 'discarded';

export interface DeliveryInboxDraft {
  id: string;
  dayKey: string;
  createdAt: string;
  updatedAt: string;
  source: DeliveryInboxSource;
  status: DeliveryInboxStatus;
  rawText: string;
  parsed: ParsedIfoodOrder;
  confidence: number;
  missingFields: string[];
  duplicateDeliveryId?: string;
  duplicateReason?: string;
}

export interface DeliveryInboxDay {
  version: 1;
  dayKey: string;
  drafts: DeliveryInboxDraft[];
}

export const DELIVERY_INBOX_PREFIX = 'dfl-delivery-inbox-v1:';

export function normalizeInboxText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferInboxSource(
  raw: string,
  parsed: ParsedIfoodOrder,
): DeliveryInboxSource {
  if (parsed.ifoodId || parsed.orderId || /\bifood\b/i.test(raw)) return 'ifood';

  if (
    /\b(?:whats?app|zap|wpp)\b/i.test(raw) ||
    /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/.test(raw)
  ) {
    return 'whatsapp';
  }

  return 'texto';
}

export function inboxSeedText(
  parsed: ParsedIfoodOrder,
  fallback = '',
) {
  const lines = [
    parsed.orderId && `Pedido: ${parsed.orderId}`,
    parsed.ifoodId && `ID iFood: ${parsed.ifoodId}`,
    parsed.confirmationCode &&
      `Código de confirmação: ${parsed.confirmationCode}`,
    parsed.customerName && `Cliente: ${parsed.customerName}`,
    parsed.phone && `WhatsApp: ${parsed.phone}`,
    parsed.address && `Endereço: ${parsed.address}`,
    parsed.mapsLink,
    parsed.customerCharge &&
      `Cliente paga: R$ ${parsed.customerCharge}`,
    parsed.subsidy && `Subsídio: R$ ${parsed.subsidy}`,
    parsed.paymentMethod && `Pagamento: ${parsed.paymentMethod}`,
    parsed.changeFor && `Troco para: R$ ${parsed.changeFor}`,
    parsed.observations.length > 0 &&
      `Obs: ${parsed.observations.join(' - ')}`,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : fallback;
}

function confidenceFor(parsed: ParsedIfoodOrder) {
  const quality = assessIfoodParseQuality([parsed]);
  const issueCount = quality.issues[0]?.fields.length || 0;

  let score = 100 - issueCount * 18;

  if (!parsed.phone) score -= 4;
  if (!parsed.mapsLink) score -= 3;

  return Math.max(20, Math.min(100, score));
}

export function findInboxDuplicate(
  parsed: ParsedIfoodOrder,
  deliveries: Delivery[],
) {
  const ifoodId = parsed.ifoodId.replace(/\D/g, '');
  const orderId = parsed.orderId.replace(/\D/g, '');
  const name = normalizeInboxText(parsed.customerName);
  const address = normalizeInboxText(parsed.address);

  for (const delivery of deliveries) {
    const existingIfood = (delivery.ifood_id || '').replace(/\D/g, '');
    const existingOrder = (delivery.order_id || '').replace(/\D/g, '');

    if (ifoodId && existingIfood === ifoodId) {
      return {
        id: delivery.id,
        reason: `ID iFood ${ifoodId} já lançado`,
      };
    }

    if (
      orderId &&
      existingOrder === orderId &&
      delivery.origin === 'ifood'
    ) {
      return {
        id: delivery.id,
        reason: `Pedido #${orderId} já lançado`,
      };
    }
  }

  if (name && address) {
    const match = deliveries.find((delivery) =>
      normalizeInboxText(delivery.customer_name) === name &&
      normalizeInboxText(delivery.address_string) === address
    );

    if (match) {
      return {
        id: match.id,
        reason:
          'Mesmo cliente e endereço já aparecem nas entregas carregadas',
      };
    }
  }

  return null;
}

export function createInboxDraft(
  parsed: ParsedIfoodOrder,
  raw: string,
  dayKey: string,
  deliveries: Delivery[],
  index: number,
): DeliveryInboxDraft {
  const quality = assessIfoodParseQuality([parsed]);
  const duplicate = findInboxDuplicate(parsed, deliveries);
  const missingFields = quality.issues[0]?.fields || [];
  const now = new Date().toISOString();

  return {
    id: `inbox-${Date.now()}-${index}-${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    dayKey,
    createdAt: now,
    updatedAt: now,
    source: inferInboxSource(raw, parsed),
    status:
      duplicate || missingFields.length > 0
        ? 'review'
        : 'ready',
    rawText: inboxSeedText(parsed, raw),
    parsed,
    confidence: confidenceFor(parsed),
    missingFields,
    duplicateDeliveryId: duplicate?.id,
    duplicateReason: duplicate?.reason,
  };
}

export function loadInboxDay(dayKey: string): DeliveryInboxDay {
  if (typeof window === 'undefined') {
    return { version: 1, dayKey, drafts: [] };
  }

  try {
    const raw = localStorage.getItem(
      `${DELIVERY_INBOX_PREFIX}${dayKey}`,
    );

    if (!raw) {
      return { version: 1, dayKey, drafts: [] };
    }

    const value = JSON.parse(raw) as DeliveryInboxDay;

    return {
      version: 1,
      dayKey,
      drafts: Array.isArray(value.drafts) ? value.drafts : [],
    };
  } catch {
    return { version: 1, dayKey, drafts: [] };
  }
}

export function saveInboxDay(day: DeliveryInboxDay) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    `${DELIVERY_INBOX_PREFIX}${day.dayKey}`,
    JSON.stringify(day),
  );
}

/**
 * Mantém a Caixa operacional pequena.
 *
 * - dias recentes permanecem disponíveis;
 * - dias antigos sem pendência são removidos;
 * - dias antigos com item ainda não resolvido são preservados;
 * - nenhuma consulta remota é feita.
 */
export function cleanupDeliveryInbox(
  todayKey: string,
  retentionDays = 7,
) {
  if (typeof window === 'undefined') return;

  const today = new Date(`${todayKey}T12:00:00`);

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);

    if (!key?.startsWith(DELIVERY_INBOX_PREFIX)) continue;

    const dayKey = key.slice(DELIVERY_INBOX_PREFIX.length);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;

    const date = new Date(`${dayKey}T12:00:00`);
    const ageDays = Math.floor(
      (today.getTime() - date.getTime()) / 86_400_000,
    );

    if (ageDays <= retentionDays) continue;

    try {
      const value = JSON.parse(
        localStorage.getItem(key) || '{}',
      ) as Partial<DeliveryInboxDay>;

      const drafts = Array.isArray(value.drafts)
        ? value.drafts
        : [];

      const hasUnresolved = drafts.some(
        (draft) =>
          draft.status !== 'launched' &&
          draft.status !== 'discarded',
      );

      if (!hasUnresolved) {
        localStorage.removeItem(key);
      }
    } catch {
      /*
       * Entrada local corrompida e antiga não deve quebrar
       * a operação atual.
       */
      localStorage.removeItem(key);
    }
  }
}

/**
 * "launching" é estado transitório de navegação.
 * Se o usuário voltar/cancelar a Nova Entrega, o rascunho precisa
 * reaparecer utilizável na Caixa.
 */
export function recoverInterruptedInboxDrafts(
  day: DeliveryInboxDay,
): DeliveryInboxDay {
  let changed = false;

  const drafts = day.drafts.map((draft) => {
    if (draft.status !== 'launching') return draft;

    changed = true;

    return {
      ...draft,
      status:
        draft.duplicateDeliveryId ||
        draft.missingFields.length > 0
          ? ('review' as const)
          : ('ready' as const),
      updatedAt: new Date().toISOString(),
    };
  });

  return changed ? { ...day, drafts } : day;
}

export function markInboxDraft(
  dayKey: string,
  id: string,
  status: DeliveryInboxStatus,
) {
  const day = loadInboxDay(dayKey);

  saveInboxDay({
    ...day,
    drafts: day.drafts.map((draft) =>
      draft.id === id
        ? {
            ...draft,
            status,
            updatedAt: new Date().toISOString(),
          }
        : draft,
    ),
  });
}
