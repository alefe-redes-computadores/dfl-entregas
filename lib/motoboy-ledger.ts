import type {
  Delivery,
  Motoboy,
  MotoboyPaymentRule,
  OperationalExpense,
  Route,
} from '@/types';
import {
  getMotoboyRoutes,
  operationalDateKey,
  routeOperationalDate,
} from '@/lib/motoboy-analytics';

export function describePaymentRule(
  rule?: MotoboyPaymentRule,
): string {
  if (!rule) return 'Pagamento ainda não configurado';

  const money = (value: number) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  if (rule.type === 'fixed') {
    return `${money(rule.fixed_amount || 0)} por diária`;
  }

  if (rule.type === 'per_delivery') {
    return `${money(rule.delivery_fee || 0)} por entrega concluída`;
  }

  return `${money(rule.fixed_amount || 0)} até ${rule.threshold || 0} entregas · + ${money(rule.extra_fee || 0)} por entrega adicional`;
}

/*
 * Compatibilidade financeira de legado.
 *
 * Regra atual:
 *   source_kind === 'motoboy_settlement'
 *
 * Registros antigos podem ter sido gravados antes desse marcador.
 * Não reescrevemos o Firestore e não consideramos qualquer despesa
 * vinculada ao motoboy como pagamento.
 *
 * Só aceitamos como acerto legado quando há evidência explícita:
 * - source_id canônico motoboy:<id>:<data>; ou
 * - lançamento do tipo motoboy com descrição/observação de
 *   diária, acerto ou pagamento do entregador.
 */
const LEGACY_SETTLEMENT_TEXT =
  /\b(?:di[aá]ria|acerto|pagamento\s+(?:de|do|ao)\s+(?:motoboy|entregador)|pagamento\s+motoboy)\b/i;

export function isMotoboySettlementExpense(
  expense: OperationalExpense,
  motoboyId: string,
): boolean {
  if (expense.motoboy_id !== motoboyId) return false;

  if (expense.source_kind === 'motoboy_settlement') {
    return true;
  }

  if (
    expense.source_id?.startsWith(`motoboy:${motoboyId}:`)
  ) {
    return true;
  }

  if (expense.type !== 'motoboy') {
    return false;
  }

  const evidence = [
    expense.description,
    expense.observation,
  ]
    .filter(Boolean)
    .join(' ');

  return LEGACY_SETTLEMENT_TEXT.test(evidence);
}

export function buildMotoboyLedger(input: {
  motoboy: Motoboy;
  routes: Route[];
  deliveries: Delivery[];
  expenses: OperationalExpense[];
}) {
  const linkedRoutes = getMotoboyRoutes(input.motoboy, input.routes);
  const routeIds = new Set(linkedRoutes.map((route) => route.id));
  const linkedDeliveries = input.deliveries.filter((delivery) =>
    routeIds.has(delivery.route_id),
  );

  const settlementExpenses = input.expenses
    .filter((expense) =>
      isMotoboySettlementExpense(
        expense,
        input.motoboy.id,
      ),
    )
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() -
        new Date(a.occurred_at).getTime(),
    );

  const otherExpenses = input.expenses
    .filter(
      (expense) =>
        expense.motoboy_id === input.motoboy.id &&
        !isMotoboySettlementExpense(
          expense,
          input.motoboy.id,
        ),
    )
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() -
        new Date(a.occurred_at).getTime(),
    );

  const settlementsByDay = new Map<string, OperationalExpense>();
  settlementExpenses.forEach((expense) => {
    const key = operationalDateKey(expense.occurred_at);
    if (!settlementsByDay.has(key)) settlementsByDay.set(key, expense);
  });

  const otherExpenseByDay = new Map<string, number>();
  otherExpenses.forEach((expense) => {
    const key = operationalDateKey(expense.occurred_at);
    otherExpenseByDay.set(
      key,
      (otherExpenseByDay.get(key) || 0) + expense.amount,
    );
  });

  const days = new Map<
    string,
    {
      key: string;
      routes: Route[];
      deliveries: Delivery[];
      settlement?: OperationalExpense;
      otherExpenses: number;
    }
  >();

  linkedRoutes.forEach((route) => {
    const value = routeOperationalDate(route);
    if (!value) return;

    const key = operationalDateKey(value);
    const current = days.get(key) || {
      key,
      routes: [],
      deliveries: [],
      settlement: settlementsByDay.get(key),
      otherExpenses: otherExpenseByDay.get(key) || 0,
    };

    current.routes.push(route);
    days.set(key, current);
  });

  linkedDeliveries.forEach((delivery) => {
    const route = linkedRoutes.find((item) => item.id === delivery.route_id);
    const value = route ? routeOperationalDate(route) : undefined;
    if (!value) return;

    const key = operationalDateKey(value);
    const current = days.get(key);
    if (!current) return;

    current.deliveries.push(delivery);
  });

  settlementExpenses.forEach((expense) => {
    const key = operationalDateKey(expense.occurred_at);
    if (days.has(key)) return;

    days.set(key, {
      key,
      routes: [],
      deliveries: [],
      settlement: expense,
      otherExpenses: otherExpenseByDay.get(key) || 0,
    });
  });

  const sortedDays = [...days.values()].sort((a, b) =>
    b.key.localeCompare(a.key),
  );

  return {
    linkedRoutes,
    linkedDeliveries,
    completedDeliveries: linkedDeliveries.filter(
      (delivery) => delivery.completed,
    ),
    settlementExpenses,
    otherExpenses,
    days: sortedDays,
    lastSettlement: settlementExpenses[0],
  };
}
