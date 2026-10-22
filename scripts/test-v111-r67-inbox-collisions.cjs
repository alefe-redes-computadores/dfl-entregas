#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/operation/siteInboxPolicy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};
const mocks={
 '@/lib/delivery-mode':{getFulfillmentMode:x=>x.fulfillment_mode||'delivery'},
 '@/lib/integration/site-order':{
  normalizeSiteOrderStatus:x=>(x||'').toLowerCase(),
  isCancelledSiteDelivery:d=>d.site_order_status==='cancelado',
 },
 '@/lib/scheduled-delivery':{isFutureScheduledDelivery:(d,now)=>Boolean(d.scheduled_for)&&Date.parse(d.scheduled_for)>now},
 '@/lib/operational-time':{dateKey:()=>'2026-10-22',routeOperationalDateKey:r=>r.operational_date},
};
new Function('require','module','exports',code)(id=>{if(!mocks[id])throw Error(id);return mocks[id];},mod,mod.exports);
const {siteInboxProjection,siteInboxState,assertSiteRouteAllocation}=mod.exports;
const now=Date.parse('2026-10-22T15:00:00Z');
const base={source_system:'dfl_site',external_order_id:'E-001',id:'one',fulfillment_mode:'delivery',site_order_status:'confirmado',completed:false,route_id:'',address_string:'Rua 20, numero 51',created_at:'2026-10-22T14:00:00Z'};
let checks=0;
for(let i=0;i<1000;i++){
 const single={...base,id:'one'+i,external_order_id:'E'+i};
 const duplicate={...base,id:'two'+i,external_order_id:'E'+i};
 const alone=siteInboxProjection([single],now);
 assert.equal(alone.ready,1);checks++;
 const double=siteInboxProjection([single,duplicate],now);
 assert.equal(double.ready,0);checks++;
 assert.equal(double.review,1);checks++;
 assert.equal(double.duplicates,1);checks++;
 assert.equal(double.rows.length,1);checks++;
 assert.equal(double.rows[0].state,'revisar');checks++;
 const mixed=siteInboxProjection([single,{...duplicate,site_order_status:'cancelado'}],now);
 assert.equal(mixed.review,1);checks++;
 assert.equal(mixed.ready,0);checks++;
 const allocated=siteInboxProjection([single,{...duplicate,route_id:'rota-1'}],now);
 assert.equal(allocated.review,1);checks++;
 assert.equal(allocated.duplicates,1);checks++;
}
const statuses=['pendente','agendado','rejeitado','cancelado','confirmado'];
for(const status of statuses){
 const delivery={...base,site_order_status:status};
 const expected=status==='confirmado'?'pronto':status==='pendente'||status==='agendado'?'confirmar':status==='cancelado'?'cancelado':'revisar';
 assert.equal(siteInboxState(delivery,now),expected);checks++;
}
const output=siteInboxProjection([{...base,id:'pickup',fulfillment_mode:'pickup'},base],now);
assert.equal(output.total,1);checks++;
console.log('R67 SITE COLISIONS: '+checks+' scenarios, duplicates fail-closed');
