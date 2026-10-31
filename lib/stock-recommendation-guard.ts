import type { StockProduct } from '@/types';
type RecommendationLike={recommendedQuantity?:number;confidence?:string;consumptionEvents?:number;distinctConsumptionDays?:number;averageDailyConsumption?:number;observedDays?:number};
const n=(value:unknown)=>{const parsed=Number(value||0);return Number.isFinite(parsed)?Math.max(0,parsed):0};
export function guardedStockRecommendation(product:StockProduct,recommendation?:RecommendationLike|null){
 const current=n(product.current_quantity);
 const configuredTarget=Math.max(n(product.minimum_quantity),n(product.ideal_quantity));
 const configuredDeficit=Math.max(0,configuredTarget-current);
 const intelligentQuantity=n(recommendation?.recommendedQuantity);
 const days=n(recommendation?.distinctConsumptionDays);
 const events=n(recommendation?.consumptionEvents);
 const confidence=String(recommendation?.confidence||'baixa').toLowerCase();
 const daily=n(recommendation?.averageDailyConsumption);
 const observed=n(recommendation?.observedDays);
 if(confidence==='alta'&&days>=6&&events>=8&&observed>=21){const extra=Math.min(daily*0.5,Math.max(1,configuredTarget*0.25));const bounded=configuredTarget>0?Math.min(intelligentQuantity,configuredDeficit+extra):Math.min(intelligentQuantity,daily*1.5);return{quantity:Math.max(configuredDeficit,bounded),configuredTarget,configuredDeficit,mode:'history' as const,reason:'Histórico consistente · margem progressiva limitada para evitar excesso'};}

 if(configuredTarget>0){
   if(confidence==='media'&&days>=4&&events>=4){const extra=Math.min(daily*0.25,Math.max(0.5,configuredTarget*0.15));const quantity=Math.min(Math.max(configuredDeficit,intelligentQuantity),configuredDeficit+extra);return{quantity,configuredTarget,configuredDeficit,mode:'guarded' as const,reason:'Histórico parcial · crescimento moderado, sem extrapolar saídas isoladas'}}
  return{quantity:configuredDeficit,configuredTarget,configuredDeficit,mode:'configured' as const,reason:'Meta configurada · histórico insuficiente'};
 }
 return{quantity:0,configuredTarget,configuredDeficit,mode:'guarded' as const,reason:'Sem meta confiável para sugerir quantidade'};
}
