export const ANALYTICS_SCHEMA_VERSION = 1 as const;

export type AnalyticsSourceSystem = 'dfl_site' | 'dfl_entregas';
export type AnalyticsFactKind =
  | 'sale'
  | 'delivery'
  | 'route'
  | 'operational_expense'
  | 'fueling'
  | 'stock_purchase';

export type AnalyticsFactIdentity = {
  schemaVersion: typeof ANALYTICS_SCHEMA_VERSION;
  sourceSystem: AnalyticsSourceSystem;
  kind: AnalyticsFactKind;
  entityId: string;
  occurredAt: string;
  correlationId?: string | null;
};

export type AnalyticsMoney = {
  gross?: number | null;
  discount?: number | null;
  deliveryFee?: number | null;
  net?: number | null;
  expense?: number | null;
};

/**
 * Contrato canônico V1. Ele não é uma coleção de relatório e não duplica
 * entidades operacionais: representa somente o fato necessário à projeção.
 * A autoridade comercial de pedidos dfl_site continua sendo o Site.
 */
export type AnalyticsFactV1 = AnalyticsFactIdentity & {
  revision: string;
  dimensions?: Record<string, string | number | boolean | null>;
  money?: AnalyticsMoney;
  payload?: Record<string, unknown>;
};

export function analyticsFactId(input: Pick<AnalyticsFactIdentity, 'sourceSystem' | 'kind' | 'entityId'>) {
  return `${input.sourceSystem}__${input.kind}__${encodeURIComponent(input.entityId)}`;
}

export type AnalyticsAuthority = 'dfl_site' | 'dfl_entregas';
export type AnalyticsEntityType = 'order' | 'delivery' | 'route' | 'operational_expense' | 'stock_purchase' | 'fueling' | 'courier_settlement';
