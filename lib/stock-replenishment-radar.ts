/** R130 — resumo conservador: estoque e compras pendentes, sem lançar movimentos. */
export type ReplenishmentRow = {
  id:string; name:string; current:number; target:number; committed:number;
  missing:number; netMissing:number; state:'covered'|'buy'|'ok';
};
export function buildReplenishmentRadar(
 products: ReadonlyArray<{id:string;name:string;current_quantity:number;minimum_quantity:number;ideal_quantity?:number;active:boolean}>,
 committed:ReadonlyMap<string,number>,
){
 const rows:ReplenishmentRow[]=[];
 for(const p of products){
  if(!p.active)continue;
  const current=Number(p.current_quantity),minimum=Number(p.minimum_quantity),ideal=Number(p.ideal_quantity||0);
  if(![current,minimum,ideal].every(x=>Number.isFinite(x)&&x>=0))continue;
  const target=Math.max(minimum,ideal);
  const missing=Math.max(0,Number((target-current).toFixed(4)));
  const pending=Number(committed.get(p.id)||0);
  const safePending=Number.isFinite(pending)?Math.max(0,pending):0;
  const netMissing=Math.max(0,Number((missing-safePending).toFixed(4)));
  rows.push({id:p.id,name:p.name,current,target,committed:safePending,missing,netMissing,state:missing===0?'ok':netMissing===0?'covered':'buy'});
 }
 return {rows,
  needsAction:rows.filter(r=>r.state==='buy').length,
  coveredByOrders:rows.filter(r=>r.state==='covered').length,
  noShortage:rows.filter(r=>r.state==='ok').length,
  pendingQuantity:rows.reduce((a,r)=>a+(r.state==='covered'?r.missing:0),0),
 };
}
