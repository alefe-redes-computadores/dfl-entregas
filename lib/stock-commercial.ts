import type { StockProductPresentation, StockSupplyUnit } from '@/types';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';

const DISCRETE=new Set<StockSupplyUnit>(['un','cx','pct','fardo']);
export const isDiscretePurchaseUnit=(unit:StockSupplyUnit)=>DISCRETE.has(unit);
const precision=(unit:StockSupplyUnit)=>unit==='kg'||unit==='l'?3:unit==='g'||unit==='ml'?1:0;

export const isFractionalPurchaseUnit=(unit:StockSupplyUnit)=>
 unit==='kg'||unit==='g'||unit==='l'||unit==='ml';

export const commercialDisplayPrecision=(unit:StockSupplyUnit,value:number)=>{
 if(isDiscretePurchaseUnit(unit)) return 0;
 const safe=Math.abs(Number(value)||0);
 if(unit==='g'||unit==='ml') return safe<10?1:0;
 return safe<1?3:safe<10?2:1;
};

const ceilToPrecision=(value:number,digits:number)=>{
 const factor=10**digits;
 return Number((Math.ceil((Math.max(0,value)-1e-12)*factor)/factor).toFixed(digits));
};

export const normalizeCommercialPurchaseQuantity=(needInBaseUnit:number,presentation?:StockProductPresentation,baseUnit:StockSupplyUnit='un')=>{
 const need=Math.max(0,Number(needInBaseUnit)||0); if(!need)return 0;
 const factor=Math.max(.0000001,Number(presentation?.conversion_quantity)||1);
 const purchaseUnit=presentation?.purchase_unit||baseUnit;
 const raw=need/factor;
 return isDiscretePurchaseUnit(purchaseUnit)
  ? Math.ceil(raw-1e-9)
  : ceilToPrecision(raw,precision(purchaseUnit));
};

export const normalizeTypedPurchaseQuantity=(value:number,unit:StockSupplyUnit)=>{
 const safe=Math.max(0,Number(value)||0);
 return isDiscretePurchaseUnit(unit)
  ? Math.ceil(safe-1e-9)
  : Number(safe.toFixed(precision(unit)));
};
export const purchaseUnitWord=(unit:StockSupplyUnit,q:number)=>{
 const one:Record<StockSupplyUnit,string>={un:'unidade',kg:'kg',g:'g',l:'L',ml:'ml',cx:'caixa',pct:'pacote',fardo:'fardo'};
 const many:Partial<Record<StockSupplyUnit,string>>={un:'unidades',cx:'caixas',pct:'pacotes',fardo:'fardos'};
 return q===1?one[unit]:(many[unit]||one[unit]);
};
export const formatPurchaseQuantity=(q:number,u:StockSupplyUnit)=>{
 const normalized=isDiscretePurchaseUnit(u)
  ? Math.ceil(Math.max(0,Number(q)||0)-1e-9)
  : Math.max(0,Number(q)||0);
 return `${normalized.toLocaleString('pt-BR',{
  maximumFractionDigits:commercialDisplayPrecision(u,normalized)
 })} ${purchaseUnitWord(u,normalized)}`;
};
export const formatCommercialPlan=({purchaseQuantity,baseQuantity,baseUnit,presentation}:{purchaseQuantity:number;baseQuantity:number;baseUnit:StockSupplyUnit;presentation?:StockProductPresentation})=>{
 if(!presentation)return formatStockQuantity(baseQuantity,baseUnit);
 const p=formatPurchaseQuantity(purchaseQuantity,presentation.purchase_unit),b=formatStockQuantity(baseQuantity,baseUnit),label=presentation.label.trim();
 return label?`${p} de ${label} (${b})`:`${p} (${b})`;
};
export const commercialUnitHint=(u:StockSupplyUnit)=>u==='g'||u==='kg'?'Ex.: pacote de 500 g, saco de 1 kg':u==='ml'||u==='l'?'Ex.: garrafa de 900 ml, galão de 5 L':u==='un'?'Ex.: pacote com 12 un, fardo com 6 un':`Conteúdo convertido para ${SUPPLY_UNIT_LABELS[u].toLocaleLowerCase('pt-BR')}`;
