/** R126 E11: metricas do card sem alocar array de entregas pendentes. */
export interface RouteMetricDelivery { completed?: boolean | number | null }
export interface RouteCardMetrics {
  totalDeliveries: number;
  pendingDeliveriesCount: number;
  totalStops: number;
  pendingStopsCount: number;
  progressPercent: number;
}
export function routeCardMetrics(
  deliveries: readonly RouteMetricDelivery[],
  totalStops: number,
  pendingStopsCount: number,
): RouteCardMetrics {
  let completed = 0;
  for (const delivery of deliveries) {
    if (delivery.completed) completed++;
  }
  const totalDeliveries = deliveries.length;
  return {
    totalDeliveries,
    pendingDeliveriesCount: totalDeliveries - completed,
    totalStops,
    pendingStopsCount,
    progressPercent: totalDeliveries ? (completed / totalDeliveries) * 100 : 0,
  };
}
