'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAppStore } from '@/store/useAppStore';
import { dateKey, routeDate, routeStartedAt } from '@/lib/operational-time';

const notificationId=(id:string)=>Math.abs([...id].reduce((hash,char)=>(hash*31+char.charCodeAt(0))|0,1609))%2000000000;

export function RouteOperations(){
  const hydrated=useAppStore(s=>s.hasHydrated);const routes=useAppStore(s=>s.routes);const deliveries=useAppStore(s=>s.deliveries);const settings=useAppStore(s=>s.storeSettings);const updateRoute=useAppStore(s=>s.updateRoute);
  useEffect(()=>{if(!hydrated||settings.autoCloseCompletedRoutes===false)return;const today=dateKey(new Date());routes.filter(route=>route.status==='aberta'&&routeStartedAt(route)&&!route.reopened_at&&dateKey(routeDate(route) || new Date())<today).forEach(route=>{const linked=deliveries.filter(delivery=>delivery.route_id===route.id);if(linked.length&&linked.every(delivery=>delivery.completed)){const base=routeDate(route)||new Date();const end=new Date(base);end.setHours(23,59,0,0);void updateRoute(route.id,{status:'fechada',end_time:route.end_time||end.toISOString(),auto_closed_at:new Date().toISOString()})}})},[deliveries,hydrated,routes,settings.autoCloseCompletedRoutes,updateRoute]);
  useEffect(()=>{if(!hydrated||!Capacitor.isNativePlatform()||settings.routeReminderEnabled===false)return;const active=routes.filter(route=>route.status==='aberta'&&routeStartedAt(route));if(!active.length)return;const at=new Date();at.setHours(23,30,0,0);if(at<=new Date())return;void LocalNotifications.schedule({notifications:active.map(route=>({id:notificationId(route.id),title:'Rota ainda aberta',body:`Confira e finalize ${route.name} antes de encerrar o expediente.`,schedule:{at}}))}).catch(()=>undefined)},[hydrated,routes,settings.routeReminderEnabled]);
  return null;
}
