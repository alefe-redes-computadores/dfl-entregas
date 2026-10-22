#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const file='lib/operation/ifoodOrderCode.ts';
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod._compile(js,file);
const {orderConfirmationCode}=mod.exports;
let checks=0;
for(let i=0;i<10000;i++){
 const v=String(i).padStart(4,'0');
 assert.equal(orderConfirmationCode(v),v);checks++;
 assert.equal(orderConfirmationCode(v+'7'),'');checks++;
 assert.equal(orderConfirmationCode('9'+v),'');checks++;
 assert.equal(orderConfirmationCode(' '+v.slice(0,2)+'-'+v.slice(2)+' '),v);checks++;
}
const source=fs.readFileSync('lib/operation/siteInboxPolicy.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};
const requireStub=(p)=>{
 if(p==='@/lib/delivery-mode')return{getFulfillmentMode:x=>x.fulfillment_mode||'delivery'};
 if(p==='@/lib/integration/site-order')return{
  normalizeSiteOrderStatus:x=>(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[\s-]+/g,'_'),
  isCancelledSiteDelivery:x=>['cancelado','cancelada'].includes((x.site_order_status||'').toLowerCase())};
 if(p==='@/lib/scheduled-delivery')return{isFutureScheduledDelivery:(d,now)=>Boolean(d.scheduled_for)&&Date.parse(d.scheduled_for)>now+30*60000};
 if(p==='@/lib/operational-time')return{dateKey:()=> '2026-10-22',routeOperationalDateKey:()=> '2026-10-22'};
 throw Error('Unknown dependency '+p);
};
new Function('require','module','exports',output)(requireStub,m,m.exports);
const {siteInboxProjection}=m.exports,now=Date.parse('2026-10-22T21:00:00-03:00');
const base={source_system:'dfl_site',site_order_status:'confirmado',completed:false,route_id:'',fulfillment_mode:'delivery',address_string:'Rua Teste, 5'};
for(let batch=0;batch<400;batch++){
 const rows=Array.from({length:50},(_,i)=>({...base,id:`${batch}-${i}`,external_order_id:`p${i}`,site_order_status:i%4===0?'pendente':i%4===1?'confirmado':i%4===2?'cancelado':'indefinido'}));
 rows.push({...rows[1],id:'dup-'+batch});
 const p=siteInboxProjection(rows,now);
 assert.equal(p.total,p.rows.length);checks++;
 assert.equal(p.total,p.ready+p.commercial+p.scheduled+p.review);checks++;
 assert.equal(p.duplicates,1);checks++;
 assert(p.rows.some(r=>r.duplicate&&r.state==='revisar'));checks++;
 assert(p.rows.every(r=>r.state!=='cancelado'));checks++;
}
console.log(`R68 BEHAVIOR: ${checks} cenarios operacionais aprovados, codigo iFood sem truncamento`);
