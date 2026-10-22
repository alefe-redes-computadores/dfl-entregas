/** Decisão pura: não confundir HTTP 2xx ou etapa executada com entrega bem-sucedida. */
export type ReverseOperationResult = {
  ok: boolean;
  failed?: number;
  unsettled?: number;
};

export function reverseDrainOutcome(
  reconciliation: ReverseOperationResult | null,
  relay: ReverseOperationResult | null,
): { ok: boolean; httpStatus: 200 | 207 } {
  const succeeded = (stage: ReverseOperationResult | null) =>
    stage === null || (
      stage.ok === true &&
      typeof (stage.failed ?? 0) === 'number' &&
      Number.isFinite(stage.failed ?? 0) &&
      (stage.failed ?? 0) === 0 &&
      typeof (stage.unsettled ?? 0) === 'number' &&
      Number.isFinite(stage.unsettled ?? 0) &&
      (stage.unsettled ?? 0) === 0
    );
  const ok = succeeded(reconciliation) && succeeded(relay);
  return { ok, httpStatus: ok ? 200 : 207 };
}
