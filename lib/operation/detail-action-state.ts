/** R303: hierarquia visual pura. Autoridades e persistência seguem nos serviços existentes. */
export type DetailActionState =
  | 'cancelled' | 'completed' | 'pickup_prepare' | 'pickup_confirm'
  | 'pickup_wait' | 'route_blocked' | 'delivery_complete' | 'service_complete';
export function detailActionState(input: {
  pickup: boolean; completed: boolean; cancelled: boolean;
  ready: boolean; canMarkReady: boolean; logistics: boolean;
  routeAvailable: boolean; routeStarted: boolean; routeClosed: boolean;
}): DetailActionState {
  if (input.cancelled) return 'cancelled';
  if (input.completed) return 'completed';
  if (input.pickup) {
    if (input.ready) return 'pickup_confirm';
    return input.canMarkReady ? 'pickup_prepare' : 'pickup_wait';
  }
  if (input.logistics) {
    if (!input.routeAvailable || !input.routeStarted || input.routeClosed) return 'route_blocked';
    return 'delivery_complete';
  }
  return 'service_complete';
}
