import type { StockProduct, StockProductPresentation, StockSupplyItem, StockSupplyUnit } from '@/types';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';

const safe=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export const stockBaseUnitCost=(item:Pick<StockSupplyItem,'unit_price'|'purchase_unit_price'|'conversion_quantity'>)=>{
  const direct=safe(item.unit_price); if(direct>0)return direct;
  const price=safe(item.purchase_unit_price), factor=safe(item.conversion_quantity);
  return price>0&&factor>0?Number((price/factor).toFixed(6)):0;
};
export const commercialPriceSummary=(price:number,presentation:StockProductPresentation,baseUnit:StockSupplyUnit)=>{
  const factor=Math.max(0,safe(presentation.conversion_quantity)); const base=factor?price/factor:0;
  const pu=SUPPLY_UNIT_LABELS[presentation.purchase_unit].toLocaleLowerCase('pt-BR');
  const bu=SUPPLY_UNIT_LABELS[baseUnit].toLocaleLowerCase('pt-BR');
  return { purchasePrice:price, baseUnitPrice:base, label:`R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}/${pu} · R$ ${base.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})}/${bu}` };
};
export const legacyCommercialState=(product:StockProduct)=>{
  const active=(product.presentations||[]).filter(p=>p.active!==false&&p.conversion_quantity>0);
  return { configured:active.length>0, presentations:active, needsReview:active.length===0 };
};
export const commercialMigrationHint=(product:StockProduct)=>{
  if((product.presentations||[]).some(p=>p.active!==false))return null;
  if(product.unit==='g')return 'Estoque em gramas: cadastre a embalagem real (ex.: pacote 500 g).';
  if(product.unit==='kg')return 'Estoque em kg: cadastre pacote/saco somente se o fornecedor vender embalagem fechada.';
  if(product.unit==='ml'||product.unit==='l')return 'Volume: cadastre garrafa/frasco apenas se essa for a forma real de compra.';
  return 'Cadastre como o fornecedor vende: unidade, pacote, caixa ou fardo. O histórico não será convertido.';
};
