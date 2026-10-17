import type { MotoboyAdjustment, MotoboySettlementAdjustment, OperationalExpense } from '@/types';

export const settlementSourceId = (motoboyId: string, operationalDate: string) =>
  `motoboy:${motoboyId}:${operationalDate}`;

export const settlementDocumentId = (sourceId: string) => `settlement-${sourceId}`;

export const pendingAdjustmentsForSettlement = (
  adjustments: MotoboyAdjustment[],
  motoboyId: string,
  operationalDate: string,
) => adjustments.filter((item) =>
  item.motoboy_id === motoboyId &&
  item.operational_date === operationalDate &&
  item.status === 'pending',
);

export const settlementAdjustmentSnapshot = (
  adjustments: MotoboyAdjustment[],
): MotoboySettlementAdjustment[] => adjustments.map(({ id, kind, direction, category_id, category_label, description, amount }) => ({
  id,
  kind,
  direction,
  category_id,
  category_label,
  description,
  amount,
}));

export const isClosedSettlement = (expense?: OperationalExpense) =>
  expense?.source_kind === 'motoboy_settlement';
