import type { AnalyticsAuthority, AnalyticsEntityType, AnalyticsFactKind } from './contracts';
import { analyticsFactIdentity } from './identity';

export type CanonicalAnalyticsFact<TPayload = Record<string, unknown>> = {
  version: 1; kind: AnalyticsFactKind; authority: AnalyticsAuthority;
  entityType: AnalyticsEntityType; entityId: string;
  sourceSystem: 'dfl_site' | 'dfl_entregas'; sourceEventId: string;
  occurredAt: string; identity: { businessKey: string; eventKey: string }; payload: TPayload;
};

export function canonicalAnalyticsFact<TPayload>(input: {
  kind: AnalyticsFactKind; authority: AnalyticsAuthority; entityType: AnalyticsEntityType;
  entityId: string; sourceSystem: 'dfl_site' | 'dfl_entregas'; sourceEventId: string;
  occurredAt: string; payload: TPayload;
}): CanonicalAnalyticsFact<TPayload> {
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error('analytics occurredAt inválido');
  return {
    version: 1, ...input,
    identity: analyticsFactIdentity({
      authority: input.authority, entityType: input.entityType, entityId: input.entityId,
      sourceSystem: input.sourceSystem, eventId: input.sourceEventId,
    }),
  };
}
