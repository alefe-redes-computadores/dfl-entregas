/**
 * Resultado do worker reverso (Entregas -> Site).
 * HTTP 2xx e sucesso na execução da função NÃO implicam que a fila foi entregue.
 * O worker da Evolution/Supabase é uma etapa separada.
 */
export type RelayStage =
  | { ok: true; value: { ok: boolean; failed?: number; unsettled?: number } }
  | { ok: false; error: string }
  | null;

export function relayStageSucceeded(stage: RelayStage): boolean {
  return stage === null || (stage.ok && stage.value.ok === true && (stage.value.failed ?? 0) === 0);
}

export type RecoveryStage =
  | { ok: true; value: {
      ok: boolean;
      statusRecoveryReplayEnabled: boolean;
      statusRecoveryReplayRead: number;
      statusRecoveryReplayEventIds: string[];
    } }
  | { ok: false; error: string }
  | null;

export function recoveryCheckpointEligible(
  reconciliation: RecoveryStage,
  targetedRelay: RelayStage,
  batchLimit: number,
): boolean {
  if (!reconciliation?.ok || !reconciliation.value.ok || !reconciliation.value.statusRecoveryReplayEnabled) return false;
  // Uma página cheia não prova que a recuperação histórica terminou.
  if (reconciliation.value.statusRecoveryReplayRead >= batchLimit) return false;
  // Quando nenhum evento foi gerado, não há relay a aguardar.
  if (!reconciliation.value.statusRecoveryReplayEventIds.length) return true;
  return targetedRelay !== null && relayStageSucceeded(targetedRelay);
}


/**
 * Relatórios diários: um claim não é conclusão.
 * Mantemos cooldown entre tentativas para não transformar um erro de rede
 * numa tempestade de leituras do Firestore.
 */
export function shouldAttemptDailyReports(
  hour: number,
  completedDateKey: string,
  todayKey: string,
  lastAttemptAtMs: number,
  nowMs: number,
  retryMs = 30 * 60 * 1000,
): boolean {
  if (hour < 4 || completedDateKey === todayKey) return false;
  return !Number.isFinite(lastAttemptAtMs) || nowMs - lastAttemptAtMs >= retryMs;
}

export function reportsCheckpointEligible(
  reportsScheduled: boolean,
  reconciliation: { ok: true; value: { ok: boolean } } | { ok: false } | null,
): boolean {
  return reportsScheduled && reconciliation?.ok === true && reconciliation.value.ok === true;
}
