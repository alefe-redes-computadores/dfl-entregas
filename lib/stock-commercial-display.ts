import type { StockProduct, StockSupplyUnit } from '@/types';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';

export function normalizedCostDisplay(product:StockProduct,baseCost:number){
 let multiplier=1; let unit:StockSupplyUnit=product.unit;
 if(product.unit==='g'){multiplier=1000;unit='kg'}
 else if(product.unit==='ml'){multiplier=1000;unit='l'}
 const value=baseCost*multiplier;
 return{value,unit,label:`${value.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2})}/${SUPPLY_UNIT_LABELS[unit].toLocaleLowerCase('pt-BR')}`};
}
export function presentationSummary(product:StockProduct){
 const active=(product.presentations||[]).filter(p=>p.active&&p.conversion_quantity>0);
 if(!active.length)return 'Compra direta na unidade de controle';
 return active.map(p=>`${p.label} · ${p.conversion_quantity.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${product.unit}`).join(' • ');
}
export function operationalUnitGuidance(product:StockProduct){
 const n=product.name.toLocaleLowerCase('pt-BR');
 if(n.includes('gás')||n.startsWith('gas ')||n.includes(' gás ')){
  return product.unit==='un'?'Botijão/cilindro por unidade é seguro sem medição real de peso. Não converta o histórico para kg.':'Gás exige revisão manual: use peso somente quando houver medição física confiável.';
 }
 if(n.includes('óleo')||n.includes('oleo')){
  return product.unit==='un'?'Controle por unidade fechada: mantenha inteiro. Se comprar por garrafa, cadastre a garrafa como apresentação.':'Controle volumétrico: mantenha a fração e cadastre a embalagem real quando aplicável.';
 }
 if(product.unit==='g'||product.unit==='kg')return 'Peso continua sendo a unidade física; embalagem de compra é separada e não altera o histórico.';
 if(product.unit==='ml'||product.unit==='l')return 'Volume continua sendo a unidade física; embalagem de compra é separada e não altera o histórico.';
 return null;
}
