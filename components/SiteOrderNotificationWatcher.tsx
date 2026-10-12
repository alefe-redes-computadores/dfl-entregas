'use client';
import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { markUnreadSiteOrders } from '@/lib/site-order-inbox';
import { notifyNewSiteOrder } from '@/lib/native/notifications';
import type { Delivery } from '@/types';
export function SiteOrderNotificationWatcher(){
 const user=useAppStore(s=>s.user),authLoaded=useAppStore(s=>s.authLoaded),hasHydrated=useAppStore(s=>s.hasHydrated);
 useEffect(()=>{if(!user||!authLoaded||!hasHydrated)return;const mountedAt=new Date(Date.now()-5000).toISOString(),seen=new Set<string>();
  return onSnapshot(query(collection(db,'deliveries'),where('updated_at','>',mountedAt)),snapshot=>{for(const change of snapshot.docChanges()){if(change.type==='removed')continue;const delivery=change.doc.data() as Delivery,id=delivery.id||change.doc.id;if(seen.has(id)||delivery.source_system!=='dfl_site'||(delivery.site_order_status||'').trim().toLocaleLowerCase('pt-BR')!=='pendente')continue;seen.add(id);markUnreadSiteOrders([id]);const state=useAppStore.getState(),customer=state.customers.find(item=>item.id===delivery.customer_id);void notifyNewSiteOrder(id,customer?.name,state.storeSettings.notificationPreferences);}},error=>console.warn('[SITE ORDER WATCHER] fallback initData preservado',error));
 },[authLoaded,hasHydrated,user]);return null;
}
