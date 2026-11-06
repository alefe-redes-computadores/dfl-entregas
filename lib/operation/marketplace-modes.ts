/** R284 — preferências comerciais independentes da logística de cada pedido. */
import type { OrderOrigin, FulfillmentMode, LogisticsProvider } from '@/types';

export type MarketplaceMode = 'dfl' | 'platform';
export type MarketplaceOrigin = Extract<OrderOrigin, 'ifood' | 'food99' | 'keeta'>;
export type MarketplaceDeliveryModes = {
  ifood: MarketplaceMode;
  food99: MarketplaceMode;
  keeta?: MarketplaceMode;
};

export const DEFAULT_MARKETPLACE_MODES: Readonly<Required<MarketplaceDeliveryModes>> = {
  ifood: 'dfl',
  food99: 'platform',
  keeta: 'platform',
};

export function isMarketplaceOrigin(origin: OrderOrigin): origin is MarketplaceOrigin {
  return origin === 'ifood' || origin === 'food99' || origin === 'keeta';
}

export function configuredMarketplaceMode(
  preferences: Partial<MarketplaceDeliveryModes> | undefined,
  origin: OrderOrigin,
): MarketplaceMode | null {
  if (!isMarketplaceOrigin(origin)) return null;
  return preferences?.[origin] ?? DEFAULT_MARKETPLACE_MODES[origin];
}

/** Calculado APENAS ao iniciar um cadastro/ao trocar de origem, nunca na edição inicial. */
export function defaultMarketplaceFulfillment(
  preferences: Partial<MarketplaceDeliveryModes> | undefined,
  origin: OrderOrigin,
): FulfillmentMode {
  return configuredMarketplaceMode(preferences, origin) === 'platform'
    ? 'external_delivery'
    : 'delivery';
}

export function mergeMarketplacePreference(
  current: Partial<MarketplaceDeliveryModes> | undefined,
  origin: MarketplaceOrigin,
  next: MarketplaceMode,
): MarketplaceDeliveryModes {
  return { ...DEFAULT_MARKETPLACE_MODES, ...current, [origin]: next };
}

/** Logística é derivada da modalidade escolhida no pedido, nunca só da origem comercial. */
export function marketplaceLogisticsProvider(origin: OrderOrigin, fulfillment: FulfillmentMode): LogisticsProvider {
  if (fulfillment === 'delivery') return 'dfl';
  if (fulfillment === 'external_delivery') return isMarketplaceOrigin(origin) ? origin : 'dfl';
  return 'customer';
}
