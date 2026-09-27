import type { StockProduct } from '@/types';
type RecommendationLike={recommendedQuantity?:number;confidence?:string;consumptionEvents?:number;distinctConsumptionDays?:number};
const n=(value:unknown)=>{const parsed=Number(value||0);return Number.isFinite(parsed)?Math.max(0,parsed):0};
export function guardedStockRecommendation(product:StockProduct,recommendation?:RecommendationLike|null){
 const current=n(product.current_quantity);
 const configuredTarget=Math.max(n(product.minimum_quantity),n(product.ideal_quantity));
 const configuredDeficit=Math.max(0,configuredTarget-current);
 const intelligentQuantity=n(recommendation?.recommendedQuantity);
 const days=n(recommendation?.distinctConsumptionDays);
 const events=n(recommendation?.consumptionEvents);
 const confidence=String(recommendation?.confidence||'baixa').toLowerCase();
 if(confidence==='alta'&&days>=6&&events>=8)return{quantity:intelligentQuantity,configuredTarget,configuredDeficit,mode:'history' as const,reason:'Histórico suficiente · consumo real + prazo de reposição'};
 if(configuredTarget>0){
  if(confidence==='media'&&days>=3&&events>=4){const ceiling=configuredDeficit>0?configuredDeficit*1.5:configuredTarget*0.5;return{quantity:Math.min(Math.max(configuredDeficit,intelligentQuantity),Math.max(configuredDeficit,ceiling)),configuredTarget,configuredDeficit,mode:'guarded' as const,reason:'Histórico parcial · sugestão limitada pela meta configurada'}}
  return{quantity:configuredDeficit,configuredTarget,configuredDeficit,mode:'configured' as const,reason:'Meta configurada · histórico insuficiente'};
 }
 return{quantity:0,configuredTarget,configuredDeficit,mode:'guarded' as const,reason:'Sem meta confiável para sugerir quantidade'};
}
