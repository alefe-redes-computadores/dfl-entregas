/**
 * DFL R91: decisão pura de atualização em primeiro plano.
 * Uma operação initData consulta várias coleções; eventos de retorno do Android,
 * visibilidade da PWA e reconexão não devem disparar o mesmo lote repetidamente.
 * Ação manual é independente deste limite e continua disponível quando online.
 */
export type ForegroundSyncContext = {
  nowMs: number;
  lastAttemptMs: number;
  lastSuccessfulSyncMs?: string | null;
  online: boolean;
  visible: boolean;
  recovering?: boolean;
};

export const PASSIVE_REFRESH_INTERVAL_MS = 10 * 60_000;
export const RECOVERY_REFRESH_INTERVAL_MS = 120_000;
export const FRESH_SUCCESS_INTERVAL_MS = 5 * 60_000;

export function shouldRefreshOnForeground(input: ForegroundSyncContext): boolean {
  const { nowMs, lastAttemptMs, lastSuccessfulSyncMs, online, visible, recovering } = input;
  if (!online || !visible || !Number.isFinite(nowMs) || nowMs <= 0) return false;
  if (!Number.isFinite(lastAttemptMs) || lastAttemptMs < 0) return false;
  const elapsedSinceAttempt = Math.max(0, nowMs - lastAttemptMs);
  const attemptLimit = recovering ? RECOVERY_REFRESH_INTERVAL_MS : PASSIVE_REFRESH_INTERVAL_MS;
  if (elapsedSinceAttempt < attemptLimit) return false;
  if (lastSuccessfulSyncMs) {
    const successMs = Date.parse(lastSuccessfulSyncMs);
    if (Number.isFinite(successMs) && successMs > 0) {
      const elapsedSinceSuccess = Math.max(0, nowMs - successMs);
      const freshnessLimit = recovering ? RECOVERY_REFRESH_INTERVAL_MS : FRESH_SUCCESS_INTERVAL_MS;
      if (elapsedSinceSuccess < freshnessLimit) return false;
    }
  }
  return true;
}
