#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
let checks=0;const ok=(x,msg)=>{assert.ok(x,'R44 '+msg);checks++};
const d=(id,opts={})=>({id,completed:false,origin:'loja',mode:'delivery',...opts});
// Implementa exatamente a filtragem barata antes do cálculo de campos pesados.
const quick=(delivery,origin,fulfillment,status,cancelled,mode)=>{
 if(origin!=='todas' && delivery.origin!==origin)return false;
 if(fulfillment!=='todas' && mode!==fulfillment)return false;
 if(status==='concluidas')return delivery.completed===true;
 if(status==='pendentes')return !delivery.completed&&!cancelled;
 if(status==='canceladas')return cancelled;
 return true;
};
const old=(delivery,origin,fulfillment,status,cancelled,mode,incomplete)=>{
 const matchesStatus=status==='todas'||(status==='pendentes'&&!delivery.completed&&!cancelled)||(status==='concluidas'&&delivery.completed)||(status==='incompletas'&&incomplete&&!cancelled)||(status==='canceladas'&&cancelled);
 return matchesStatus&&(origin==='todas'||delivery.origin===origin)&&(fulfillment==='todas'||mode===fulfillment);
};
const cases=[d('a'),d('b',{completed:true}),d('c',{origin:'ifood'}),d('d',{completed:true,origin:'ifood'}),d('e',{origin:'ifood',cancelled:true}),d('f',{mode:'pickup'}),d('g',{mode:'counter',origin:'ifood'})];
for(const origin of ['todas','ifood','loja'])for(const fulfillment of ['todas','delivery','pickup','counter'])for(const status of ['todas','pendentes','concluidas','incompletas','canceladas'])for(const item of cases)for(const incomplete of [true,false]){
 const cancelled=!!item.cancelled;
 const before=old(item,origin,fulfillment,status,cancelled,item.mode,incomplete);
 const after=quick(item,origin,fulfillment,status,cancelled,item.mode)&&old(item,origin,fulfillment,status,cancelled,item.mode,incomplete);
 ok(before===after,'filtros preservados '+[origin,fulfillment,status,item.id,incomplete].join(','));
}
function oldAgg(deliveries){return {completed:deliveries.filter(x=>x.completed).length,amount:deliveries.reduce((n,x)=>n+x.amount,0),charge:deliveries.reduce((n,x)=>n+x.charge,0)}}
function newAgg(deliveries){let completed=0,amount=0,charge=0;for(const x of deliveries){if(x.completed)completed++;amount+=x.amount;charge+=x.charge;}return {completed,amount,charge}}
for(let seed=0;seed<75;seed++){
 const arr=Array.from({length:seed},(_,idx)=>({completed:idx%3===0,amount:idx*0.5,charge:idx*0.3}));
 ok(JSON.stringify(oldAgg(arr))===JSON.stringify(newAgg(arr)),'agregados preservados '+seed);
}
const stock=fs.readFileSync('app/estoque/compras/page.tsx','utf8');ok(stock.includes('displayed.slice(0, visibleLimit)'),'renderização progressiva mantida');ok(stock.includes('selectedProducts = useMemo'),'seleção completa independente da página visível');
const route=fs.readFileSync('app/rotas/page.tsx','utf8');ok(route.includes('deliveryEconomicValue(delivery)'),'valor econômico preservado');ok(route.includes('deliveryCustomerCharge(delivery)'),'cobrança distinta preservada');
console.log('R44 OPERATION:',checks,'regressões OK');
