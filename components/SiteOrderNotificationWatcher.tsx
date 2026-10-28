'use client';

import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { markUnreadSiteOrders, readUnreadSiteOrderIds } from '@/lib/site-order-inbox';
import { notifyNewSiteOrder } from '@/lib/native/notifications';
import type { Delivery } from '@/types';

export function SiteOrderNotificationWatcher() {
  // UID primitivo evita reassinar o listener quando o objeto User muda sem troca de conta.
  const uid = useAppStore((state) => state.user?.uid);
  const authLoaded = useAppStore((state) => state.authLoaded);
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!uid || !authLoaded || !hasHydrated) return;

    const mountedAt = new Date(Date.now() - 5_000).toISOString();
    const seen = new Set<string>();

    return onSnapshot(
      query(collection(db, 'deliveries'), where('updated_at', '>', mountedAt)),
      (snapshot) => {
        // Um callback antigo de outra conta jamais cria alerta na sessão atual.
        if (useAppStore.getState().user?.uid !== uid) return;
        // Uma leitura local e um índice de clientes por lote. O listener continua
        // único, mas um lote grande do Site deixa de fazer trabalho N x M.
        const unreadBefore = new Set(readUnreadSiteOrderIds());
        const state = useAppStore.getState();
        const customerById = new Map(state.customers.map((item) => [item.id, item]));
        const newUnreadIds: string[] = [];
        const notifications: Array<{ id: string; customerName?: string }> = [];

        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed' || change.doc.metadata?.hasPendingWrites) continue;
          const delivery = change.doc.data() as Delivery;
          const id = delivery.id || change.doc.id;
          const pending = (delivery.site_order_status || '')
            .trim()
            .toLocaleLowerCase('pt-BR') === 'pendente';

          if (seen.has(id) || delivery.source_system !== 'dfl_site' || !pending) continue;
          seen.add(id);
          newUnreadIds.push(id);

          if (!unreadBefore.has(id)) {
            notifications.push({
              id,
              customerName: customerById.get(delivery.customer_id || '')?.name,
            });
          }
        }

        if (newUnreadIds.length) markUnreadSiteOrders(newUnreadIds);
        for (const item of notifications) {
          void notifyNewSiteOrder(
            item.id,
            item.customerName,
            state.storeSettings.notificationPreferences,
          );
        }
      },
      (error) => console.warn('[SITE ORDER WATCHER] fallback initData preservado', error),
    );
  }, [authLoaded, hasHydrated, uid]);

  return null;
}
