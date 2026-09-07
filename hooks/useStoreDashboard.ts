// hooks/useStoreDashboard.ts
'use client';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { dateFromKey, dateKey, deliveryDate, routeDate, shiftDateKey } from '@/lib/operational-time';
import type { Delivery, Route } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';

export interface StoreDashboardData {
  selectedDate:Date; selectedDateKey:string; setSelectedDateKey:(key:string)=>void;
  goToPreviousDay:()=>void; goToNextDay:()=>void; formattedDateLabel:string;
  selectedDateOrders:Delivery[]; selectedDateDeliveries:Delivery[]; selectedDateRoutes:Route[]; datesWithOperation:Set<string>;
  totalEntregas:number; completedDeliveries:number; pendingDeliveries:number;
  faturamentoTotal:number; receivedTotal:number; pendingTotal:number; ticketMedio:number;
  revenueByMethod:Record<string,number>; routesSummary:Array<{name:string;motoboy:string;status:Route['status'];deliveries:Delivery[]}>;
}

export function useStoreDashboard():StoreDashboardData {
  const deliveries=useAppStore(state=>state.deliveries); const routes=useAppStore(state=>state.routes);
  const [selectedDateKey,setSelectedDateKey]=useState(()=>dateKey(new Date()));
  const selectedDate=dateFromKey(selectedDateKey);
  const selectedDateOrders=useMemo(()=>deliveries.filter(delivery=>{const value=deliveryDate(delivery);return Boolean(value)&&dateKey(value)===selectedDateKey;}),[deliveries,selectedDateKey]);
  const selectedDateRoutes=useMemo(()=>routes.filter(route=>{const value=routeDate(route);return Boolean(value)&&dateKey(value)===selectedDateKey;}),[routes,selectedDateKey]);
  const selectedRouteIds=useMemo(()=>new Set(selectedDateRoutes.map(route=>route.id)),[selectedDateRoutes]);
  const selectedDateDeliveries=useMemo(()=>deliveries.filter(delivery=>{
    if(!isDeliveryFulfillment(delivery))return false;
    if(selectedRouteIds.has(delivery.route_id))return true;
    const value=deliveryDate(delivery);
    return Boolean(value)&&dateKey(value)===selectedDateKey;
  }),[deliveries,selectedDateKey,selectedRouteIds]);
  const datesWithOperation=useMemo(()=>new Set([...deliveries.map(deliveryDate),...routes.map(routeDate)].filter(Boolean).map(dateKey)),[deliveries,routes]);
  const totalEntregas=selectedDateDeliveries.length; const completedDeliveries=selectedDateDeliveries.filter(item=>item.completed).length; const pendingDeliveries=totalEntregas-completedDeliveries;
  const faturamentoTotal=selectedDateOrders.reduce((sum,item)=>sum+(item.value||0),0);
  const receivedTotal=selectedDateOrders.filter(item=>item.is_paid||item.completed).reduce((sum,item)=>sum+(item.value||0),0);
  const pendingTotal=Math.max(0,faturamentoTotal-receivedTotal); const ticketMedio=selectedDateOrders.length?faturamentoTotal/selectedDateOrders.length:0;
  const revenueByMethod=useMemo(()=>selectedDateOrders.reduce<Record<string,number>>((acc,item)=>{const method=item.payment_method||'dinheiro';acc[method]=(acc[method]||0)+(item.value||0);return acc;},{}),[selectedDateOrders]);
  const routesSummary=useMemo(()=>selectedDateRoutes.map(route=>({name:route.name,motoboy:route.motoboy_name,status:route.status,deliveries:selectedDateDeliveries.filter(item=>item.route_id===route.id)})),[selectedDateDeliveries,selectedDateRoutes]);
  const formattedDateLabel=selectedDateKey===dateKey(new Date())?'Hoje':selectedDate.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  return {selectedDate,selectedDateKey,setSelectedDateKey,goToPreviousDay:()=>setSelectedDateKey(key=>shiftDateKey(key,-1)),goToNextDay:()=>setSelectedDateKey(key=>shiftDateKey(key,1)),formattedDateLabel,selectedDateOrders,selectedDateDeliveries,selectedDateRoutes,datesWithOperation,totalEntregas,completedDeliveries,pendingDeliveries,faturamentoTotal,receivedTotal,pendingTotal,ticketMedio,revenueByMethod,routesSummary};
}
