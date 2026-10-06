import type { StockProduct, StockProductPresentation, StockSupplyUnit } from '@/types';

export type StockUnitSemanticStatus='keep'|'presentation_fix'|'review'|'migration_candidate';

export interface StockUnitSemanticFinding{
 status:StockUnitSemanticStatus;
 reasons:string[];
}

const COMMERCIAL=new Set<StockSupplyUnit>(['pct','cx','fardo']);
const PHYSICAL=new Set<StockSupplyUnit>(['un','kg','g','l','ml']);

const normalize=(value?:string)=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export const isPhysicalStockUnit=(unit:StockSupplyUnit)=>PHYSICAL.has(unit);
export const isCommercialStockUnit=(unit:StockSupplyUnit)=>COMMERCIAL.has(unit);

export function presentationSemanticIssues(product:StockProduct,p:StockProductPresentation){
 const reasons:string[]=[];
 const label=normalize(p.label);
 const q=Number(p.conversion_quantity)||0;

 if(product.unit==='un'){
  const match=label.match(/(?:com|[-–—]|\[|\()\s*(\d+(?:[.,]\d+)?)\s*(?:un|unid|unidade)/);
  const labelled=match?Number(match[1].replace(',','.')):0;
  if(labelled>1&&Math.abs(q-labelled)>.0001)
   reasons.push(`rotulo_indica_${labelled}_un_mas_fator_${q}`);
 }

 if(/\bfardo\b/.test(label)&&p.purchase_unit!=='fardo') reasons.push('rotulo_fardo_unidade_comercial_incorreta');
 if(/\bcaixa\b|\bcx\b/.test(label)&&p.purchase_unit!=='cx') reasons.push('rotulo_caixa_unidade_comercial_incorreta');
 if(/\bpacote\b|\bpct\b/.test(label)&&p.purchase_unit!=='pct') reasons.push('rotulo_pacote_unidade_comercial_incorreta');

 return reasons;
}

export function classifyStockUnitSemantics(product:StockProduct):StockUnitSemanticFinding{
 const reasons=product.presentations?.flatMap(p=>presentationSemanticIssues(product,p))||[];

 if(isCommercialStockUnit(product.unit)){
  return {
   status:'migration_candidate',
   reasons:['base_em_embalagem_comercial',...reasons],
  };
 }

 if(reasons.length) return {status:'presentation_fix',reasons};

 if(product.unit==='un'&&(product.presentations||[]).some(p=>
   /(?:g|kg|ml|litro|\bl\b)/i.test(p.label)&&Number(p.conversion_quantity)>1
 )){
  return {status:'review',reasons:['unidade_base_un_com_apresentacao_de_peso_ou_volume']};
 }

 return {status:'keep',reasons:[]};
}

export function convertPhysicalQuantity(value:number,factor:number){
 if(!Number.isFinite(value)||!Number.isFinite(factor)||factor<=0) throw new Error('Conversão física inválida.');
 const result=value*factor;
 return Math.abs(result)<1e-9?0:Number(result.toFixed(6));
}
