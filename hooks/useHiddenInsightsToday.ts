// hooks/useHiddenInsightsToday.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'dfl-hidden-operational-insights';

type HiddenInsightState = {
  dateKey: string;
  ids: string[];
};

function saoPauloDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function readState(): HiddenInsightState {
  const today = saoPauloDateKey();

  if (typeof window === 'undefined') {
    return { dateKey: today, ids: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dateKey: today, ids: [] };

    const parsed = JSON.parse(raw) as Partial<HiddenInsightState>;

    if (
      parsed.dateKey !== today ||
      !Array.isArray(parsed.ids)
    ) {
      return { dateKey: today, ids: [] };
    }

    return {
      dateKey: today,
      ids: parsed.ids.filter((id): id is string => typeof id === 'string'),
    };
  } catch {
    return { dateKey: today, ids: [] };
  }
}

function writeState(state: HiddenInsightState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Se o navegador bloquear storage, a ocultação ainda funciona na sessão atual.
  }
}

export function useHiddenInsightsToday() {
  const [state, setState] = useState<HiddenInsightState>(() => ({
    dateKey: saoPauloDateKey(),
    ids: [],
  }));

  useEffect(() => {
    const current = readState();
    setState(current);
    writeState(current);
  }, []);

  const hiddenIds = useMemo(() => new Set(state.ids), [state.ids]);

  const hideForToday = useCallback((insightId: string) => {
    setState((current) => {
      const today = saoPauloDateKey();
      const baseIds = current.dateKey === today ? current.ids : [];
      const ids = baseIds.includes(insightId)
        ? baseIds
        : [...baseIds, insightId];

      const next = { dateKey: today, ids };
      writeState(next);
      return next;
    });
  }, []);

  const isHiddenToday = useCallback(
    (insightId: string) => hiddenIds.has(insightId),
    [hiddenIds],
  );

  return {
    hiddenIds,
    hideForToday,
    isHiddenToday,
  };
}
