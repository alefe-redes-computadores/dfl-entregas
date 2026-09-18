// lib/scheduled-delivery.ts
import type { Delivery } from "@/types";
export function scheduledDeliveryReleaseAt(delivery: Pick<Delivery,"scheduled_for"|"schedule_window_minutes">): number | null {
  if(!delivery.scheduled_for)return null;
  const target=Date.parse(delivery.scheduled_for);
  if(!Number.isFinite(target))return null;
  const lead=Math.max(0,Number(delivery.schedule_window_minutes)||30);
  return target-lead*60_000;
}
export function isFutureScheduledDelivery(delivery: Pick<Delivery,"scheduled_for"|"schedule_window_minutes">,now=Date.now()){
  const release=scheduledDeliveryReleaseAt(delivery);
  return release!==null&&now<release;
}
