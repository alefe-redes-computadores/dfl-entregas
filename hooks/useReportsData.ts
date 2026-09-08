import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { buildReportModel } from '@/lib/reports/buildReportModel';
import type { ReportPeriodKey } from '@/lib/reports/types';

/**
 * Adapter fino para consumidores que ainda prefiram um hook.
 * Toda regra analítica vive em lib/reports; este arquivo não inventa datas,
 * não corrige timezone manualmente e não contém métricas próprias.
 */
export function useReportsData(periodKey: ReportPeriodKey = '7d') {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const stockSupplies = useAppStore((state) => state.stockSupplies);

  return useMemo(
    () =>
      buildReportModel({
        deliveries,
        routes,
        customers,
        stockSupplies,
        periodKey,
      }),
    [customers, deliveries, periodKey, routes, stockSupplies],
  );
}
