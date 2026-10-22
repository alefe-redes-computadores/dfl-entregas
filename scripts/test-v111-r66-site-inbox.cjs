const fs=require('fs');const path=require('path');
const ts=require('typescript');
const file=fs.readFileSync('lib/operation/siteInboxPolicy.ts','utf8');
const js=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const cache={exports:{}};const requireStub=id=>{
 if(id==='@/lib/delivery-mode')return {getFulfillmentMode: d=>d.fulfillment_mode||'delivery'};
 if(id==='@/lib/integration/site-order')return {
  normalizeSiteOrderStatus:x=>(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[\s-]+/g,'_'),
  isCancelledSiteDelivery:d=>d.source_system==='dfl_site'&&['cancelado','cancelada','cancelled','canceled'].includes((d.site_order_status||'').toLowerCase()),
 };
 if(id==='@/lib/scheduled-delivery')return {isFutureScheduledDelivery:(d,now)=>Boolean(d.scheduled_for)&&Date.parse(d.scheduled_for)-(d.schedule_window_minutes||30)*60_000>now};
 if(id==='@/lib/operational-time')return {dateKey:d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),routeOperationalDateKey:r=>r.operational_date};
 throw new Error('Dependency unknown: '+id);
};
new Function('require','module','exports',js)(requireStub,cache,cache.exports);
const {siteInboxState,siteInboxProjection,assertSiteRouteAllocation}=cache.exports;
let checks=0;function ok(v,m){if(!v)throw new Error('R66 scenario: '+m);checks++}
const now=Date.parse('2026-10-22T20:30:00-03:00');
const base={id:'site-order-v1__P123',source_system:'dfl_site',external_order_id:'P123',site_order_status:'confirmado',route_id:'',fulfillment_mode:'delivery',completed:false,address_string:'Rua X, 5',created_at:'2026-10-22T20:00:00-03:00'};
const route={id:'rota-1',status:'aberta',operational_date:'2026-10-22',name:'Centro',motoboy_name:'Joao'};
const allowed=['confirmado','preparando','em_preparo','aceito','aprovado','pronta'];
for(const status of allowed){const d={...base,site_order_status:status};ok(siteInboxState(d,now)==='pronto',status);assertSiteRouteAllocation(d,route,now);checks++;}
for(const status of ['pendente','agendado','cancelado','cancelada','rejeitado','desconhecido','em_analise']){
 const d={...base,site_order_status:status};ok(siteInboxState(d,now)!=='pronto','bloqueia '+status);
 try{assertSiteRouteAllocation(d,route,now);throw Error('nao bloqueou '+status)}catch(e){ok(!String(e.message).includes('nao bloqueou'),'reject '+status)}
}
for(const altered of [
 {completed:true},{route_id:'rota-1'},{fulfillment_mode:'pickup'},{fulfillment_mode:'counter'},
 {source_system:'ifood'},{address_string:''},{scheduled_for:'2026-10-24T20:00:00-03:00'},
]){
 const d={...base,...altered};try{assertSiteRouteAllocation(d,route,now);throw Error('nao bloqueou '+JSON.stringify(altered))}catch(e){ok(!String(e.message).includes('nao bloqueou'),'restricao '+JSON.stringify(altered))}
}
for(const altered of [{status:'fechada'},{started_at:'2026-10-22T20:00:00-03:00'},{operational_date:'2026-10-21'}]){
 try{assertSiteRouteAllocation(base,{...route,...altered},now);throw Error('rota nao bloqueada')}catch(e){ok(e.message!=='rota nao bloqueada','rota fechada/iniciada/fora da data')}
}
const list=[base,{...base,id:'dup',external_order_id:'P123'}, {...base,id:'outro',external_order_id:'P124',site_order_status:'pendente'},
 {...base,id:'cancelado',external_order_id:'P125',site_order_status:'cancelado'},{...base,id:'retirada',external_order_id:'P126',fulfillment_mode:'pickup'},
 {...base,id:'agendamento',external_order_id:'P127',scheduled_for:'2026-10-25T20:00:00-03:00'}];
const proj=siteInboxProjection(list,now);ok(proj.total===3,'proj sem duplicacoes/cancelados/retiradas');ok(proj.ready===0 && proj.commercial===1 && proj.scheduled===1 && proj.review===1 && proj.duplicates===1,'colisao do ID externo exige revisao, sem liberar rota');
for(let k=0;k<800;k++){
 const deliveries=Array.from({length:100},(_,i)=>({...base,id:'d'+i,external_order_id:'n'+i,site_order_status:i%3===0?'cancelado':i%3===1?'pendente':'confirmado',route_id:i%7===0?'rota':'',fulfillment_mode:i%9===0?'pickup':'delivery'}));
 const p=siteInboxProjection(deliveries,now);ok(p.total===p.rows.length,'contagem lista integrada '+k);
 ok(p.total===p.ready+p.commercial+p.review+p.scheduled,'particao estados '+k);
}
console.log('R66 SITE INBOX: '+checks+' testes comportamentais OK');
