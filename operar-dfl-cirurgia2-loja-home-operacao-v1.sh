#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$ROOT"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 2"
echo " LOJA + HOME + OPERAÇÃO V1"
echo "============================================================"

echo
echo "== 1/9 PRE-FLIGHT =="

[[ "$(pwd)" == "$ROOT" ]] || {
  echo "ABORTADO: diretório incorreto: $(pwd)"
  exit 1
}

for f in \
  app/page.tsx \
  app/loja/page.tsx \
  hooks/useStoreDashboard.ts \
  hooks/useStoreAutomation.ts \
  components/home/ShiftBriefing.tsx \
  store/useAppStore.ts \
  lib/operational-time.ts
do
  [[ -f "$f" ]] || {
    echo "ABORTADO: arquivo obrigatório ausente: $f"
    exit 1
  }
done

HEAD="$(git rev-parse HEAD)"
EXPECTED="bd62420056346fae7a30314b9a7d38c81a1f17ad"

if [[ "$HEAD" != "$EXPECTED" ]]; then
  echo "ABORTADO: HEAD divergiu da tomografia."
  echo "Esperado: $EXPECTED"
  echo "Atual:    $HEAD"
  git log -1 --oneline
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ABORTADO: existem alterações rastreadas antes da cirurgia."
  git status --short
  exit 1
fi

grep -q "window.setInterval(checkOperationState, 10_000)" hooks/useStoreAutomation.ts || {
  echo "ABORTADO: automação divergiu."
  exit 1
}

grep -q "const \[selectedDateKey,setSelectedDateKey\]=useState" hooks/useStoreDashboard.ts || {
  echo "ABORTADO: dashboard divergiu."
  exit 1
}

grep -q "fetch(\`https://brasilapi.com.br/api/feriados/v1/" app/loja/page.tsx || {
  echo "ABORTADO: fluxo de feriados divergiu."
  exit 1
}

grep -q "const datesWithOperation = new Set<string>();" app/page.tsx || {
  echo "ABORTADO: Home divergiu."
  exit 1
}

echo "Pre-flight OK."
git log -1 --oneline

echo
echo "== 2/9 BACKUP =="

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia2-loja-home-operacao-$STAMP"
mkdir -p "$BACKUP"

cp --parents \
  app/page.tsx \
  app/loja/page.tsx \
  hooks/useStoreDashboard.ts \
  hooks/useStoreAutomation.ts \
  components/home/ShiftBriefing.tsx \
  store/useAppStore.ts \
  "$BACKUP"

echo "Backup: $BACKUP"

echo
echo "== 3/9 DASHBOARD OPERACIONAL ÚNICO =="

cat > hooks/useStoreDashboard.ts <<'EOF'
// hooks/useStoreDashboard.ts
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  dateKey,
  deliveryDate,
  routeDate,
} from '@/lib/operational-time';
import type { Delivery, Route } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';

export interface StoreDashboardData {
  selectedDate: Date;
  selectedDateKey: string;
  setSelectedDateKey: (key: string) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  formattedDateLabel: string;

  selectedDateOrders: Delivery[];
  selectedDateDeliveries: Delivery[];
  selectedDateRoutes: Route[];
  datesWithOperation: Set<string>;

  totalEntregas: number;
  completedDeliveries: number;
  pendingDeliveries: number;

  faturamentoTotal: number;
  receivedTotal: number;
  pendingTotal: number;
  ticketMedio: number;

  revenueByMethod: Record<string, number>;

  routesSummary: Array<{
    name: string;
    motoboy: string;
    status: Route['status'];
    deliveries: Delivery[];
  }>;
}

export function useStoreDashboard(): StoreDashboardData {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);

  /*
   * Home, Loja e modais passam a compartilhar a MESMA data operacional.
   * Antes a Loja mantinha um useState próprio enquanto a Home usava Zustand.
   */
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const goToPreviousDay = useAppStore(
    (state) => state.goToPreviousDay,
  );
  const goToNextDay = useAppStore(
    (state) => state.goToNextDay,
  );

  const selectedDateKey = dateKey(selectedDate);

  const operation = useMemo(() => {
    const selectedDateOrders: Delivery[] = [];
    const selectedDateRoutes: Route[] = [];
    const datesWithOperation = new Set<string>();

    for (const route of routes) {
      const value = routeDate(route);

      if (value) {
        const key = dateKey(value);
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          selectedDateRoutes.push(route);
        }
      }
    }

    for (const delivery of deliveries) {
      const value = deliveryDate(delivery);

      if (value) {
        const key = dateKey(value);
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          selectedDateOrders.push(delivery);
        }
      }
    }

    const selectedRouteIds = new Set(
      selectedDateRoutes.map((route) => route.id),
    );

    /*
     * Mantém entregas vinculadas a uma rota do dia mesmo quando o registro
     * individual perdeu timestamp. Esse comportamento já existia.
     */
    const selectedDateDeliveries = deliveries.filter((delivery) => {
      if (!isDeliveryFulfillment(delivery)) return false;

      if (
        delivery.route_id &&
        selectedRouteIds.has(delivery.route_id)
      ) {
        return true;
      }

      const value = deliveryDate(delivery);

      return Boolean(
        value && dateKey(value) === selectedDateKey,
      );
    });

    let completedDeliveries = 0;
    let faturamentoTotal = 0;
    let receivedTotal = 0;

    const revenueByMethod: Record<string, number> = {};

    for (const delivery of selectedDateDeliveries) {
      if (delivery.completed) completedDeliveries += 1;
    }

    for (const order of selectedDateOrders) {
      const value = order.value || 0;

      faturamentoTotal += value;

      if (order.is_paid || order.completed) {
        receivedTotal += value;
      }

      const method = order.payment_method || 'dinheiro';
      revenueByMethod[method] =
        (revenueByMethod[method] || 0) + value;
    }

    const deliveriesByRoute = new Map<string, Delivery[]>();

    for (const delivery of selectedDateDeliveries) {
      if (!delivery.route_id) continue;

      const bucket =
        deliveriesByRoute.get(delivery.route_id) || [];

      bucket.push(delivery);
      deliveriesByRoute.set(delivery.route_id, bucket);
    }

    const routesSummary = selectedDateRoutes.map((route) => ({
      name: route.name,
      motoboy: route.motoboy_name,
      status: route.status,
      deliveries: deliveriesByRoute.get(route.id) || [],
    }));

    const totalEntregas = selectedDateDeliveries.length;
    const pendingDeliveries = Math.max(
      0,
      totalEntregas - completedDeliveries,
    );

    const pendingTotal = Math.max(
      0,
      faturamentoTotal - receivedTotal,
    );

    const ticketMedio = selectedDateOrders.length
      ? faturamentoTotal / selectedDateOrders.length
      : 0;

    return {
      selectedDateOrders,
      selectedDateRoutes,
      selectedDateDeliveries,
      datesWithOperation,
      totalEntregas,
      completedDeliveries,
      pendingDeliveries,
      faturamentoTotal,
      receivedTotal,
      pendingTotal,
      ticketMedio,
      revenueByMethod,
      routesSummary,
    };
  }, [deliveries, routes, selectedDateKey]);

  const formattedDateLabel =
    selectedDateKey === dateKey(new Date())
      ? 'Hoje'
      : selectedDate.toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

  return {
    selectedDate,
    selectedDateKey,

    setSelectedDateKey: (key) => {
      setSelectedDate(
        new Date(`${key}T12:00:00-03:00`),
      );
    },

    goToPreviousDay,
    goToNextDay,
    formattedDateLabel,

    ...operation,
  };
}
EOF

echo "Dashboard unificado: OK"

echo
echo "== 4/9 AUTOMAÇÃO POR FRONTEIRA DE MINUTO =="

cat > hooks/useStoreAutomation.ts <<'EOF'
'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import { isWithinSchedule } from '@/lib/operational-time';
import { syncShiftNotifications } from '@/lib/native/notifications';

const millisecondsToNextMinute = () => {
  const now = Date.now();

  /*
   * A automação só depende de minuto.
   * A pequena margem evita disparar exatamente antes da virada do relógio.
   */
  return 60_000 - (now % 60_000) + 150;
};

export function useStoreAutomation() {
  const hasHydrated = useAppStore(
    (state) => state.hasHydrated,
  );

  const alertsEnabled = useAppStore(
    (state) => state.storeSettings.alertsEnabled,
  );

  const schedule = useAppStore(
    (state) => state.storeSettings.schedule,
  );

  const pauses = useAppStore(
    (state) => state.storeSettings.pauses,
  );

  const holidaysOverrides = useAppStore(
    (state) => state.storeSettings.holidaysOverrides,
  );

  const notificationPreferences = useAppStore(
    (state) => state.storeSettings.notificationPreferences,
  );

  useEffect(() => {
    if (!hasHydrated) return;

    void syncShiftNotifications({
      alertsEnabled,
      schedule,
      pauses,
      holidaysOverrides,
      notificationPreferences,
    });
  }, [
    alertsEnabled,
    hasHydrated,
    holidaysOverrides,
    notificationPreferences,
    pauses,
    schedule,
  ]);

  useEffect(() => {
    if (!hasHydrated) return;

    let timer: number | undefined;
    let disposed = false;

    const checkOperationState = async () => {
      const state = useAppStore.getState();
      const settings = state.storeSettings;

      if (
        !settings?.schedule ||
        !settings.alertsEnabled
      ) {
        return;
      }

      const shouldBeOpen = isWithinSchedule(
        new Date(),
        settings.schedule,
        settings.pauses,
        settings.holidaysOverrides,
      );

      if (shouldBeOpen === Boolean(settings.isOpen)) {
        return;
      }

      try {
        await state.updateStoreSettings({
          isOpen: shouldBeOpen,
        });

        if (Capacitor.isNativePlatform()) {
          void Haptics.impact({
            style: ImpactStyle.Heavy,
          });
        }
      } catch (error) {
        console.error(
          'Falha ao atualizar estado automático da loja:',
          error,
        );
      }
    };

    const scheduleNextCheck = () => {
      if (disposed) return;

      window.clearTimeout(timer);

      timer = window.setTimeout(async () => {
        await checkOperationState();
        scheduleNextCheck();
      }, millisecondsToNextMinute());
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      void checkOperationState();
      scheduleNextCheck();
    };

    /*
     * Verifica imediatamente e depois apenas na próxima virada de minuto.
     * Ao voltar para o PWA, sincroniza novamente.
     */
    void checkOperationState();
    scheduleNextCheck();

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    window.addEventListener(
      'focus',
      onVisibilityChange,
    );

    return () => {
      disposed = true;
      window.clearTimeout(timer);

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );

      window.removeEventListener(
        'focus',
        onVisibilityChange,
      );
    };
  }, [hasHydrated]);

  return null;
}
EOF

echo "Automação otimizada: OK"

echo
echo "== 5/9 STORE SETTINGS COM ROLLBACK =="

node <<'NODE'
const fs = require('fs');

const file = 'store/useAppStore.ts';
let src = fs.readFileSync(file, 'utf8');

function once(before, after, label) {
  const count = src.split(before).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: esperado 1 trecho, encontrado ${count}`,
    );
  }

  src = src.replace(before, after);
}

once(
`      updateStoreSettings: async (settings) => {
        const currentSettings = get().storeSettings;
        const newSettings = { ...currentSettings, ...settings };

        set({ storeSettings: newSettings });

        try {
          const safeData = sanitizeForFirebase(newSettings);
          await setDoc(doc(db, 'store', 'store_settings'), safeData, { merge: true });
        } catch (error) {
          console.error('Erro ao salvar configurações:', error);
        }
      },`,
`      updateStoreSettings: async (settings) => {
        const currentSettings = get().storeSettings;
        const newSettings = {
          ...currentSettings,
          ...settings,
        };

        // Optimistic UI: a Loja reage imediatamente.
        set({ storeSettings: newSettings });

        try {
          const safeData =
            sanitizeForFirebase(newSettings);

          await setDoc(
            doc(db, 'store', 'store_settings'),
            safeData,
            { merge: true },
          );
        } catch (error) {
          console.error(
            'Erro ao salvar configurações:',
            error,
          );

          /*
           * Rollback apenas se ninguém alterou as configurações depois.
           * Evita uma gravação antiga apagar uma mudança mais recente.
           */
          if (get().storeSettings === newSettings) {
            set({ storeSettings: currentSettings });
          }

          throw error;
        }
      },`,
  'updateStoreSettings com rollback',
);

fs.writeFileSync(file, src);
console.log('Store settings: OK');
NODE

echo
echo "== 6/9 HOME + LOJA =="

node <<'NODE'
const fs = require('fs');

/* ----------------------------------------------------------
 * HOME
 * Coloca toda a tomografia operacional pesada dentro de useMemo.
 * ---------------------------------------------------------- */

{
  const file = 'app/page.tsx';
  let src = fs.readFileSync(file, 'utf8');

  src = src.replace(
    `import { useState } from 'react';`,
    `import { useMemo, useState } from 'react';`,
  );

  const start =
    `  const selectedDateKey = saoPauloDateKey(selectedDate);\n\n  const datesWithOperation = new Set<string>();`;

  const end =
    `  // Função para pegar ícone do motoboy para o cabeçalho do grupo`;

  const startIndex = src.indexOf(start);
  const endIndex = src.indexOf(end);

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(
      'Home: bloco operacional esperado não encontrado.',
    );
  }

  const replacement = `  const selectedDateKey = saoPauloDateKey(selectedDate);

  /*
   * Tomografia operacional da Home.
   * Antes cada render percorria routes/deliveries muitas vezes,
   * inclusive ao apenas tocar no filtro ou no modo privacidade.
   */
  const homeOperation = useMemo(() => {
    const datesWithOperation = new Set<string>();
    const allRouteIds = new Set<string>();
    const baseRoutesDoDia: Route[] = [];

    for (const route of routes) {
      allRouteIds.add(route.id);

      const key = operationalKey(
        route.created_at,
        route.started_at,
        route.departure_time,
      );

      if (key) {
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          baseRoutesDoDia.push(route);
        }
      }
    }

    const ordersDoDia = [];

    for (const delivery of deliveries) {
      const key = operationalKey(
        delivery.created_at,
        delivery.createdAt,
      );

      if (key) {
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          ordersDoDia.push(delivery);
        }
      }
    }

    let routesDoDia = globalMotoboy
      ? baseRoutesDoDia.filter(
          (route) =>
            route.motoboy_name === globalMotoboy,
        )
      : [...baseRoutesDoDia];

    routesDoDia.sort((a, b) => {
      const aDate = firstValidTimestamp(
        a.created_at,
        a.started_at,
        a.departure_time,
      );

      const bDate = firstValidTimestamp(
        b.created_at,
        b.started_at,
        b.departure_time,
      );

      return (
        (aDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (bDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );
    });

    const routeIdsDoDia = new Set(
      routesDoDia.map((route) => route.id),
    );

    const deliveriesDoDia = deliveries.filter(
      (delivery) => {
        if (!isDeliveryFulfillment(delivery)) {
          return false;
        }

        if (
          delivery.route_id &&
          routeIdsDoDia.has(delivery.route_id)
        ) {
          return true;
        }

        if (globalMotoboy) return false;

        const deliveryKey = operationalKey(
          delivery.created_at,
          delivery.createdAt,
        );

        const hasValidRoute = Boolean(
          delivery.route_id &&
            allRouteIds.has(delivery.route_id),
        );

        return (
          deliveryKey === selectedDateKey &&
          !hasValidRoute
        );
      },
    );

    const orphanedDeliveries =
      deliveriesDoDia.filter(
        (delivery) =>
          !delivery.route_id ||
          !allRouteIds.has(delivery.route_id),
      );

    if (
      orphanedDeliveries.length > 0 &&
      !globalMotoboy
    ) {
      routesDoDia.push({
        id: 'rota-resgate-recuperada',
        name: 'Rota Geral de Recuperação',
        status: 'aberta',
        motoboy_name: 'Sistema',
        departure_time: selectedDate.toISOString(),
        change_money: 0,
        drinks_summary:
          'Entregas sem rota válida — corrigir vínculo',
      });
    }

    const deliveriesByRoute = new Map<string, typeof deliveriesDoDia>();

    for (const delivery of deliveriesDoDia) {
      if (!delivery.route_id) continue;

      const bucket =
        deliveriesByRoute.get(delivery.route_id) || [];

      bucket.push(delivery);
      deliveriesByRoute.set(
        delivery.route_id,
        bucket,
      );
    }

    const totalEntregas = deliveriesDoDia.length;
    const pendingDeliveries =
      deliveriesDoDia.filter(
        (delivery) => !delivery.completed,
      ).length;

    const completedDeliveries = Math.max(
      0,
      totalEntregas - pendingDeliveries,
    );

    const storeOrdersDoDia = ordersDoDia
      .filter(
        (order) =>
          !isDeliveryFulfillment(order),
      )
      .sort((a, b) => {
        const aDate = firstValidTimestamp(
          a.created_at,
          a.createdAt,
        );

        const bDate = firstValidTimestamp(
          b.created_at,
          b.createdAt,
        );

        return (
          (aDate?.getTime() ?? 0) -
          (bDate?.getTime() ?? 0)
        );
      });

    const pickupCount =
      storeOrdersDoDia.filter(
        (order) =>
          getFulfillmentMode(order) === 'pickup',
      ).length;

    const counterCount =
      storeOrdersDoDia.filter(
        (order) =>
          getFulfillmentMode(order) === 'counter',
      ).length;

    const faturamentoTotal = ordersDoDia.reduce(
      (acc, order) => acc + (order.value || 0),
      0,
    );

    const openRoutes = routesDoDia.filter(
      (route) => route.status === 'aberta',
    );

    const closedRoutes = routesDoDia.filter(
      (route) => route.status === 'fechada',
    );

    const readyRoutes = openRoutes.filter((route) => {
      if (
        route.id === 'rota-resgate-recuperada'
      ) {
        return false;
      }

      const linked =
        deliveriesByRoute.get(route.id) || [];

      return (
        linked.length > 0 &&
        linked.every(
          (delivery) =>
            delivery.completed === true,
        )
      );
    });

    const closedRoutesByMotoboy =
      closedRoutes.reduce((acc, route) => {
        if (!acc[route.motoboy_name]) {
          acc[route.motoboy_name] = [];
        }

        acc[route.motoboy_name].push(route);
        return acc;
      }, {} as Record<string, Route[]>);

    const activeMotoboyNames = new Set(
      baseRoutesDoDia.flatMap((route) => [
        route.motoboy_id || '',
        route.motoboy_name,
      ]),
    );

    const activeMotoboysToday =
      motoboys.filter(
        (motoboy) =>
          activeMotoboyNames.has(motoboy.id) ||
          activeMotoboyNames.has(motoboy.name),
      );

    return {
      datesWithOperation,
      routesDoDia,
      ordersDoDia,
      deliveriesDoDia,
      totalEntregas,
      pendingDeliveries,
      completedDeliveries,
      storeOrdersDoDia,
      pickupCount,
      counterCount,
      faturamentoTotal,
      openRoutes,
      closedRoutes,
      readyRoutes,
      closedRoutesByMotoboy,
      activeMotoboysToday,
    };
  }, [
    deliveries,
    globalMotoboy,
    motoboys,
    routes,
    selectedDate,
    selectedDateKey,
  ]);

  const {
    datesWithOperation,
    routesDoDia,
    ordersDoDia,
    deliveriesDoDia,
    totalEntregas,
    pendingDeliveries,
    completedDeliveries,
    storeOrdersDoDia,
    pickupCount,
    counterCount,
    faturamentoTotal,
    openRoutes,
    closedRoutes,
    readyRoutes,
    closedRoutesByMotoboy,
    activeMotoboysToday,
  } = homeOperation;

  const formatOrderTime = (
    order: (typeof ordersDoDia)[number],
  ) => {
    const timestamp = firstValidTimestamp(
      order.created_at,
      order.createdAt,
    );

    return timestamp
      ? timestamp.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '--:--';
  };

`;

  src =
    src.slice(0, startIndex) +
    replacement +
    src.slice(endIndex);

  fs.writeFileSync(file, src);
  console.log('Home memoizada: OK');
}

/* ----------------------------------------------------------
 * LOJA
 * - separa hidratação local da busca de feriados
 * - feriado é carregado uma vez por ano
 * - saves passam a mostrar erro real
 * ---------------------------------------------------------- */

{
  const file = 'app/loja/page.tsx';
  let src = fs.readFileSync(file, 'utf8');

  const oldEffect = `  useEffect(() => {
    setIsMounted(true);
    if (hasHydrated && storeSettings) {
      setIsStoreOpen(storeSettings.isOpen ?? false);
      setAlertsEnabled(storeSettings.alertsEnabled ?? false);
      setStoreAddress(storeSettings.storeAddress || 'Patos de Minas, MG');
      setStorePoint(Number.isFinite(storeSettings.storeLatitude)&&Number.isFinite(storeSettings.storeLongitude)?{lat:Number(storeSettings.storeLatitude),lng:Number(storeSettings.storeLongitude)}:null);
      setStoreLocationReference(storeSettings.storeMapsLink||'');
      setSchedule(storeSettings.schedule || {});
      setPauses(storeSettings.pauses || []);
      setHolidaysOverrides(storeSettings.holidaysOverrides || {});

      fetch(\`https://brasilapi.com.br/api/feriados/v1/\${new Date().getFullYear()}\`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setApiHolidays(data.filter((h: any) => new Date(h.date).getTime() >= new Date().getTime() - 86400000)); })
        .catch(() => {});
    }
  }, [storeSettings, hasHydrated]);`;

  const newEffect = `  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    setIsStoreOpen(storeSettings.isOpen ?? false);
    setAlertsEnabled(storeSettings.alertsEnabled ?? false);
    setStoreAddress(
      storeSettings.storeAddress ||
        'Patos de Minas, MG',
    );

    setStorePoint(
      Number.isFinite(storeSettings.storeLatitude) &&
        Number.isFinite(storeSettings.storeLongitude)
        ? {
            lat: Number(storeSettings.storeLatitude),
            lng: Number(storeSettings.storeLongitude),
          }
        : null,
    );

    setStoreLocationReference(
      storeSettings.storeMapsLink || '',
    );

    setSchedule(storeSettings.schedule || {});
    setPauses(storeSettings.pauses || []);
    setHolidaysOverrides(
      storeSettings.holidaysOverrides || {},
    );
  }, [hasHydrated, storeSettings]);

  useEffect(() => {
    if (!hasHydrated) return;

    const controller = new AbortController();
    const year = new Date().getFullYear();

    fetch(
      \`https://brasilapi.com.br/api/feriados/v1/\${year}\`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            \`BrasilAPI respondeu \${response.status}\`,
          );
        }

        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;

        const yesterday =
          Date.now() - 86_400_000;

        setApiHolidays(
          data.filter(
            (holiday: any) =>
              new Date(holiday.date).getTime() >=
              yesterday,
          ),
        );
      })
      .catch((error) => {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        console.warn(
          'Não foi possível carregar feriados:',
          error,
        );
      });

    return () => controller.abort();
  }, [hasHydrated]);`;

  if (!src.includes(oldEffect)) {
    throw new Error(
      'Loja: efeito de hidratação/feriados divergiu.',
    );
  }

  src = src.replace(oldEffect, newEffect);

  const oldToggle = `  const toggleStore = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    const newState = !isStoreOpen;
    setIsStoreOpen(newState);
    await updateStoreSettings({ isOpen: newState });
    toast.success(newState ? 'Operação Aberta!' : 'Operação Fechada!');
  };`;

  const newToggle = `  const toggleStore = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({
        style: ImpactStyle.Heavy,
      });
    }

    const previousState = isStoreOpen;
    const newState = !previousState;

    setIsStoreOpen(newState);

    try {
      await updateStoreSettings({
        isOpen: newState,
      });

      toast.success(
        newState
          ? 'Operação aberta!'
          : 'Operação fechada!',
      );
    } catch (error) {
      setIsStoreOpen(previousState);

      toast.error(
        'Não foi possível alterar a operação.',
        {
          description:
            'A alteração local foi desfeita.',
        },
      );
    }
  };`;

  if (!src.includes(oldToggle)) {
    throw new Error(
      'Loja: toggleStore divergiu.',
    );
  }

  src = src.replace(oldToggle, newToggle);

  const oldSave = `  const handleSaveAllSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    await updateStoreSettings({ ...storeSettings, isOpen: isStoreOpen, storeAddress: storeAddress.trim(), storeLatitude:storePoint?.lat, storeLongitude:storePoint?.lng, storeMapsLink:storeLocationReference.trim()||undefined, alertsEnabled, schedule, pauses, holidaysOverrides });
    toast.success('Expediente salvo com sucesso!');
  };`;

  const newSave = `  const handleSaveAllSettings = async (
    e?: React.FormEvent,
  ) => {
    if (e) e.preventDefault();

    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({
        style: ImpactStyle.Medium,
      });
    }

    try {
      await updateStoreSettings({
        isOpen: isStoreOpen,
        storeAddress: storeAddress.trim(),
        storeLatitude: storePoint?.lat,
        storeLongitude: storePoint?.lng,
        storeMapsLink:
          storeLocationReference.trim() ||
          undefined,
        alertsEnabled,
        schedule,
        pauses,
        holidaysOverrides,
      });

      toast.success(
        'Configurações da operação salvas.',
      );
    } catch (error) {
      toast.error(
        'Não foi possível salvar as configurações.',
        {
          description:
            'Confira sua conexão e tente novamente.',
        },
      );
    }
  };`;

  if (!src.includes(oldSave)) {
    throw new Error(
      'Loja: handleSaveAllSettings divergiu.',
    );
  }

  src = src.replace(oldSave, newSave);

  fs.writeFileSync(file, src);
  console.log('Loja consolidada: OK');
}
NODE

echo
echo "== 7/9 SHIFT BRIEFING =="

cat > components/home/ShiftBriefing.tsx <<'EOF'
'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Bike,
  PackageCheck,
  Play,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { dateKey } from '@/lib/operational-time';
import { supplyDate } from '@/lib/stock-supply';

export function ShiftBriefing() {
  const isStoreOpen = useAppStore(
    (state) => state.storeSettings.isOpen,
  );

  const updateStoreSettings = useAppStore(
    (state) => state.updateStoreSettings,
  );

  const motoboys = useAppStore(
    (state) => state.motoboys,
  );

  const supplies = useAppStore(
    (state) => state.stockSupplies,
  );

  const activeMotoboys = useMemo(
    () =>
      motoboys.filter(
        (item) => item.active,
      ),
    [motoboys],
  );

  const today = dateKey(new Date());
  const storageKey =
    `dfl-shift-started:${today}`;

  const [seen, setSeen] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSeen(
      localStorage.getItem(storageKey) === '1',
    );
  }, [storageKey]);

  const bought = useMemo(
    () =>
      supplies.filter(
        (item) =>
          dateKey(supplyDate(item)) === today,
      ).length,
    [supplies, today],
  );

  if (seen) return null;

  const start = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await updateStoreSettings({
        isOpen: true,
      });

      localStorage.setItem(
        storageKey,
        '1',
      );

      setSeen(true);
    } catch (error) {
      toast.error(
        'Não foi possível abrir a operação.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[26px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.10] to-sky-500/[.05] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Store size={20} />
        </span>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">
            Primeira abertura do dia
          </p>

          <h2 className="font-heading text-lg font-black text-zinc-100">
            Começar expediente?
          </h2>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-zinc-950/45 p-3">
          <p className="flex items-center gap-1 text-[9px] font-black text-sky-400">
            <Bike size={11} />
            EQUIPE ATIVA
          </p>

          <p className="mt-1 line-clamp-2 text-xs font-bold text-zinc-300">
            {activeMotoboys.length
              ? `${activeMotoboys.length} entregador${
                  activeMotoboys.length === 1
                    ? ''
                    : 'es'
                } ativo${
                  activeMotoboys.length === 1
                    ? ''
                    : 's'
                }`
              : 'Nenhum motoboy ativo'}
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-950/45 p-3">
          <p className="flex items-center gap-1 text-[9px] font-black text-amber-400">
            <PackageCheck size={11} />
            COMPRAS HOJE
          </p>

          <p className="mt-1 text-xs font-bold text-zinc-300">
            {bought} registro
            {bought === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-black text-zinc-950 disabled:opacity-50"
      >
        <Play size={16} />
        {busy
          ? 'Abrindo operação...'
          : 'Abrir operação de hoje'}
      </button>

      {isStoreOpen && (
        <p className="mt-2 text-center text-[10px] text-zinc-500">
          A loja já está marcada como aberta;
          confirme para dispensar este resumo.
        </p>
      )}
    </section>
  );
}
EOF

echo "Shift Briefing consolidado: OK"

echo
echo "== 8/9 CONTRATOS + TYPESCRIPT =="

grep -q "const operation = useMemo" hooks/useStoreDashboard.ts
grep -q "state.selectedDate" hooks/useStoreDashboard.ts

if grep -q "useState(()=>dateKey(new Date()))" hooks/useStoreDashboard.ts; then
  echo "ERRO: dashboard ainda possui data local."
  exit 1
fi

if grep -q "setInterval(checkOperationState, 10_000)" hooks/useStoreAutomation.ts; then
  echo "ERRO: timer antigo de 10s sobreviveu."
  exit 1
fi

grep -q "millisecondsToNextMinute" hooks/useStoreAutomation.ts
grep -q "visibilitychange" hooks/useStoreAutomation.ts

grep -q "throw error" store/useAppStore.ts
grep -q "const homeOperation = useMemo" app/page.tsx
grep -q "controller.abort()" app/loja/page.tsx

COUNT_FERIADOS="$(grep -c "brasilapi.com.br/api/feriados" app/loja/page.tsx || true)"

[[ "$COUNT_FERIADOS" == "1" ]] || {
  echo "ERRO: esperado exatamente 1 fetch de feriados; encontrado $COUNT_FERIADOS."
  exit 1
}

echo "Contratos: OK"

echo
echo "--- git diff --check ---"
git diff --check

echo
echo "--- TypeScript ---"
node node_modules/typescript/bin/tsc --noEmit

echo
echo "TypeScript: OK"

echo
echo "== 9/9 RESULTADO =="

echo
echo "--- diff stat ---"
git diff --stat

echo
echo "--- status ---"
git status --short

echo
echo "============================================================"
echo " CIRURGIA 2 — LOJA + HOME + OPERAÇÃO V1 APLICADA"
echo "============================================================"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "CONTRATOS:"
echo "  OK Home e Loja compartilham a mesma data operacional"
echo "  OK Dashboard não mantém calendário paralelo"
echo "  OK Dashboard agrega operação em bloco memoizado"
echo "  OK Home move tomografia pesada para useMemo"
echo "  OK Home preserva rota de recuperação de órfãos"
echo "  OK Home preserva pedidos retirada/balcão"
echo "  OK automação deixou de acordar a cada 10 segundos"
echo "  OK automação verifica na fronteira do minuto"
echo "  OK automação revalida ao voltar para o PWA"
echo "  OK notificações de turno preservadas"
echo "  OK updateStoreSettings agora possui rollback"
echo "  OK erro de Firestore volta a ser observável"
echo "  OK abrir/fechar Loja desfaz UI se persistência falhar"
echo "  OK salvar configurações mostra falha real"
echo "  OK feriados não são buscados a cada alteração de settings"
echo "  OK fetch de feriados é cancelado ao desmontar"
echo "  OK Shift Briefing não cria array no selector Zustand"
echo "  OK Shift Briefing resume equipe em vez de parede de nomes"
echo "  OK nenhuma migração de dados"
echo "  OK git diff --check"
echo "  OK TypeScript"
echo
echo "NÃO faça commit ainda."
echo "Me mande TODO o retorno desta cirurgia."
