import type { StockSupplyUnit } from '@/types';
export type QuantityDisplayUnit=StockSupplyUnit;
export const quantityChoices=(base:StockSupplyUnit):QuantityDisplayUnit[]=>base==='kg'?['g','kg']:base==='l'?['ml','l']:[base];
export const toBaseQuantity=(value:number,display:QuantityDisplayUnit,base:StockSupplyUnit)=>display==='g'&&base==='kg'?value/1000:display==='ml'&&base==='l'?value/1000:value;
export const fromBaseQuantity=(value:number,display:QuantityDisplayUnit,base:StockSupplyUnit)=>display==='g'&&base==='kg'?value*1000:display==='ml'&&base==='l'?value*1000:value;
export const quantityUnitLabel=(unit:QuantityDisplayUnit)=>({un:'un',kg:'kg',g:'g',l:'L',ml:'ml',cx:'cx',pct:'pct',fardo:'fardo'}[unit]);
export const formatStockQuantity=(value:number,unit:StockSupplyUnit)=>{const display=unit==='kg'&&value>0&&value<1?'g':unit==='l'&&value>0&&value<1?'ml':unit;return `${fromBaseQuantity(value,display,unit).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${quantityUnitLabel(display)}`};
