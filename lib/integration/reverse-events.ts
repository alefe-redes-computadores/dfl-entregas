import type { Delivery, Route } from "@/types";
import { buildIntegrationEvent, type IntegrationEventEnvelope } from "./contracts";
import { deliveryStopKey, groupDeliveriesByStop } from "@/lib/route-stops";

export type DflSiteReverseEventType =
  | "delivery.assigned"
  | "delivery.out_for_delivery"
  | "delivery.position_changed"
  | "delivery.next_stop"
  | "delivery.completed"
  | "delivery.failed"
  | "route.started"
  | "route.reordered"
  | "route.completed";

export type DflSiteDeliveryTrackingPayload = {
  externalOrderId: string;
  externalOrderSource: "dfl_site";
  deliveryId: string;
  routeId: string | null;
  routeName: string | null;
  motoboyId: string | null;
  motoboyName: string | null;
  stopGroupId: string;
  stopPosition: number | null;
  stopsAhead: number | null;
  totalStops: number | null;
  nextStop: boolean;
  completedAt: string | null;
  failedReason: string | null;
};

export function isDflSiteDelivery(delivery: Delivery) {
  return (
    delivery.source_system === "dfl_site" &&
    typeof delivery.external_order_id === "string" &&
    delivery.external_order_id.trim().length > 0
  );
}

export function routeTrackingSnapshot(
  delivery: Delivery,
  route: Route | null,
  routeDeliveries: Delivery[],
): DflSiteDeliveryTrackingPayload {
  const groups = groupDeliveriesByStop(routeDeliveries);
  const key = deliveryStopKey(delivery);
  const stopIndex = groups.findIndex((group) => group.key === key);
  const pendingGroups = groups.filter((group) => group.pending.length > 0);
  const pendingIndex = pendingGroups.findIndex((group) => group.key === key);

  return {
    externalOrderId: String(delivery.external_order_id),
    externalOrderSource: "dfl_site",
    deliveryId: delivery.id,
    routeId: delivery.route_id || route?.id || null,
    routeName: route?.name || null,
    motoboyId: route?.motoboy_id || null,
    motoboyName: route?.motoboy_name || null,
    stopGroupId: key,
    stopPosition: stopIndex >= 0 ? stopIndex + 1 : null,
    stopsAhead: pendingIndex >= 0 ? pendingIndex : null,
    totalStops: groups.length || null,
    nextStop: pendingIndex === 0,
    completedAt: delivery.completed_at || null,
    failedReason: null,
  };
}

export function buildDflSiteTrackingEvent(input: {
  eventType: DflSiteReverseEventType;
  delivery: Delivery;
  route: Route | null;
  routeDeliveries: Delivery[];
  occurredAt: string;
  occurrenceId: string;
}): IntegrationEventEnvelope<DflSiteDeliveryTrackingPayload> {
  if (!isDflSiteDelivery(input.delivery)) {
    throw new Error("Delivery não pertence a pedido externo do DFL Site.");
  }

  return buildIntegrationEvent({
    event_id: `evt-v1__${input.eventType}__${encodeURIComponent(input.delivery.id)}__${input.occurrenceId}`,
    event_type: input.eventType,
    occurred_at: input.occurredAt,
    source_system: "dfl_entregas",
    entity_type: "delivery",
    entity_id: input.delivery.id,
    correlation_id: input.delivery.external_order_id,
    payload: routeTrackingSnapshot(input.delivery, input.route, input.routeDeliveries),
  });
}
