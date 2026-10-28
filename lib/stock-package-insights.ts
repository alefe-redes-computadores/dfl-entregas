/** R129: calculos de apresentacao, sem efeitos colaterais ou conversao inferida. */
export function stockPackageBreakdown(baseBalance:number, factor:number){
 if(!Number.isFinite(baseBalance)||baseBalance<0||!Number.isFinite(factor)||factor<=0)return null;
 const full=Math.floor((baseBalance+1e-8)/factor);
 const loose=Math.max(0,Number((baseBalance-full*factor).toFixed(4)));
 return {full,loose,equivalent:baseBalance/factor};
}
export function stockMovementDeltaPreview(
 current:number, typed:number, factor:number,
 type:'entrada'|'saida'|'perda'|'contagem'|'ajuste',
 mode:'moved'|'remaining'
){
 if([current,typed,factor].some(x=>!Number.isFinite(x))||current<0||typed<0||factor<=0)return null;
 const base=Number((typed*factor).toFixed(4));
 const next=type==='entrada'?current+base:type==='saida'||type==='perda'?(mode==='remaining'?base:current-base):base;
 if(next< -0.0001)return null;
 return {base,after:Number(Math.max(0,next).toFixed(4)),before:current};
}
