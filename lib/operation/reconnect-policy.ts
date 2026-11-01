/** R230 — reconciliação após retorno da conexão sem tempestade de leituras. */
export const RECONNECT_COOLDOWN_MS = 180_000;
export const RECONNECT_DELAY_MS = 900;
export function mayReconcileAfterReconnect(input: {
  wasOffline: boolean;
  online: boolean;
  authenticated: boolean;
  hydrated: boolean;
  syncing: boolean;
  elapsedSinceLastAttemptMs: number;
  hasSyncError: boolean;
  hasUnverifiedWrite: boolean;
}): boolean {
  return input.wasOffline && input.online && input.authenticated && input.hydrated &&
    !input.syncing && (input.hasSyncError || input.hasUnverifiedWrite) &&
    input.elapsedSinceLastAttemptMs >= RECONNECT_COOLDOWN_MS;
}
