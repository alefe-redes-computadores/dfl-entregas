import type { StockMovement, StockProduct } from '@/types';
import { buildStockRecommendation } from '@/lib/stock-intelligence';
import { commercialPurchasePlan } from '@/lib/stock-shopping';
import { guardedStockRecommendation } from '@/lib/stock-recommendation-guard';

const DAY=86400000;
const validOperational=(m:StockMovement)=>m.type==='saida'&&!m.supply_id&&!/estorno|revers|ajuste|contagem|saldo inicial/i.test(m.reason||'')&&m.quantity>0;
export function buildDailyStockSignal(product:StockProduct,movements:StockMovement[],now=new Date()){
 const weekday=now.getDay();
 const rows=movements.filter(m=>m.product_id===product.id&&validOperational(m)).map(m=>({m,d:new Date(m.occurred_at)})).filter(x=>Number.isFinite(x.d.getTime())&&x.d<=now&&now.getTime()-x.d.getTime()<=120*DAY&&x.d.getDay()===weekday);
 const byDay=new Map<string,number>();
 for(const {m,d} of rows){const k=d.toISOString().slice(0,10);byDay.set(k,(byDay.get(k)||0)+m.quantity)}
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
