import type { StockMovement, StockProduct } from '@/types';
import { buildStockRecommendation } from '@/lib/stock-intelligence';
import { commercialPurchasePlan } from '@/lib/stock-shopping';
import { guardedStockRecommendation } from '@/lib/stock-recommendation-guard';

const DAY=86400000;
const stockDayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', {
 timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);
const stockWeekday = (date: Date) => new Intl.DateTimeFormat('en-US', {
 timeZone: 'America/Sao_Paulo', weekday: 'short'
}).format(date);
const normalizedStockReason = (reason?: string) => (reason || '')
 .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const validOperational = (m: StockMovement) =>
 m.type === 'saida' && !m.supply_id && Number.isFinite(m.quantity) && m.quantity > 0 &&
 !/estorno|revers|correc|ajuste|contagem|saldo inicial/.test(normalizedStockReason(m.reason));
export function buildDailyStockSignal(product:StockProduct,movements:StockMovement[],now=new Date()){
 const weekday=stockWeekday(now);
 const rows=movements.filter(m=>m.product_id===product.id&&validOperational(m)).map(m=>({m,d:new Date(m.occurred_at)})).filter(x=>Number.isFinite(x.d.getTime())&&x.d<=now&&now.getTime()-x.d.getTime()<=120*DAY&&stockWeekday(x.d)===weekday);
 const byDay=new Map<string,number>();
 for(const {m,d} of rows){const k=stockDayKey(d);byDay.set(k,(byDay.get(k)||0)+m.quantity)}
 const samples=[...byDay.values()];
 const weekdayAverage=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:0;
 const rec=buildStockRecommendation(product,movements,now);
 const enough=samples.length>=3;
 const guarded=guardedStockRecommendation(product,rec);
 const historyTarget=Math.max(Number(product.minimum_quantity)||0,weekdayAverage+Math.max(0,rec.averageDailyConsumption*rec.leadTimeDays));
 const rawHistorySuggested=Math.max(0,historyTarget-product.current_quantity);
 const rawSuggested=guarded.mode==='history'&&enough?rawHistorySuggested:guarded.quantity;
 const dailyTarget=Math.max(0,product.current_quantity+rawSuggested);
 const commercialPlan=commercialPurchasePlan(product,rawSuggested,0);
 const suggested=commercialPlan.baseQuantity;
 return {
  weekdaySamples:samples.length,
  weekdayAverage,
  dailyTarget,
  rawSuggested,
  suggested,
  commercialPlan,
  usesWeekday:guarded.mode==='history'&&enough,
  confidence:samples.length>=8?'alta':samples.length>=4?'media':'baixa' as const,
  recommendationMode:guarded.mode,
  recommendationReason:guarded.reason
 };
}
