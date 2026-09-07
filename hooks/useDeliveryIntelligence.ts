// hooks/useDeliveryIntelligence.ts
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  buildOperationalIntelligence,
  selectOperationalHighlights,
} from '@/lib/delivery-intelligence';

export function useDeliveryIntelligence(options?: {
  lookbackDays?: number;
  minimumSample?: number;
  highlightLimit?: number;
}) {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const motoboys = useAppStore((state) => state.motoboys);
  const fuelings = useAppStore((state) => state.fuelings);

  const lookbackDays = options?.lookbackDays ?? 30;
  const minimumSample = options?.minimumSample ?? 3;
  const highlightLimit = options?.highlightLimit ?? 3;

  return useMemo(() => {
    const snapshot = buildOperationalIntelligence({
      deliveries,
      routes,
      customers,
      motoboys,
      fuelings,
      lookbackDays,
      minimumSample,
    });

    return {
      ...snapshot,
      highlights: selectOperationalHighlights(snapshot.insights, {
        limit: highlightLimit,
        minimumSample,
      }),
    };
  }, [
    customers,
    deliveries,
    fuelings,
    highlightLimit,
    lookbackDays,
    minimumSample,
    motoboys,
    routes,
  ]);
}
