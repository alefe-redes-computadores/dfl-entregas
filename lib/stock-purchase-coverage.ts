import type {StockProduct} from '@/types';
export type StockPurchaseCoverage = {id:string;name:string;unit:string;current:number;target:number;missing:number;pending:number;remaining:number;state:'need'|'covered'|'ok'};
export function buildStockPurchaseCoverage(products:readonly StockProduct[], committed:ReadonlyMap<string,number>):StockPurchaseCoverage[]{
 const rows:StockPurchaseCoverage[]=[];
 for(const p of products){
  if(!p.active)continue;
  const current=Number(p.current_quantity),min=Number(p.minimum_quantity),ideal=Number(p.ideal_quantity||0);
  if(![current,min,ideal].every(v=>Number.isFinite(v)&&v>=0))continue;
  const target=Math.max(min,ideal);
  if(target<=0)continue;
  const missing=Math.max(0,Number((target-current).toFixed(4)));
  const raw=Number(committed.get(p.id)||0);
  const pending=Number.isFinite(raw)&&raw>0?raw:0;
  const remaining=Math.max(0,Number((missing-pending).toFixed(4)));
  const state=missing===0?'ok':remaining===0?'covered':'need';
  rows.push({id:p.id,name:p.name,unit:p.unit,current,target,missing,pending,remaining,state});
 }
 return rows.sort((a,b)=>({need:0,covered:1,ok:2}[a.state]-{need:0,covered:1,ok:2}[b.state])||b.remaining-a.remaining||a.name.localeCompare(b.name,'pt-BR'));
}
