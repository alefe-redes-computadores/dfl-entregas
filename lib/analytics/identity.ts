import type { AnalyticsAuthority, AnalyticsEntityType } from './contracts';

export function analyticsBusinessKey(authority: AnalyticsAuthority, entityType: AnalyticsEntityType, entityId: string): string {
  const id = entityId.trim();
  if (!id) throw new Error('analytics entityId vazio');
  return `${authority}:${entityType}:${id}`;
}

export function analyticsEventKey(sourceSystem: string, eventId: string): string {
  const source = sourceSystem.trim(), event = eventId.trim();
  if (!source || !event) throw new Error('analytics event identity inválida');
  return `${source}:${event}`;
}

export function analyticsFactIdentity(input: {
  authority: AnalyticsAuthority; entityType: AnalyticsEntityType; entityId: string;
  sourceSystem: string; eventId: string;
}): { businessKey: string; eventKey: string } {
  return {
    businessKey: analyticsBusinessKey(input.authority, input.entityType, input.entityId),
    eventKey: analyticsEventKey(input.sourceSystem, input.eventId),
  };
}
