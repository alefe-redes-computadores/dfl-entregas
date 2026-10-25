#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
let checks=0;
const ok=(v,name)=>{assert.ok(v,'R85: '+name);console.log('OK:',name);checks++};
const read=p=>fs.readFileSync(p,'utf8');
for(const f of ['lib/whatsapp.ts','lib/route-share-card.ts','components/home/RouteAccordion.tsx','components/home/DeliveryCard.tsx','components/routes/RouteDepartureChecklist.tsx','scripts/pre-apk.cjs']){
 const s=read(f);const t=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(t.parseDiagnostics.length===0,'AST '+f);
}
const wa=read('lib/whatsapp.ts'), route=read('components/home/RouteAccordion.tsx'), card=read('components/home/DeliveryCard.tsx'), image=read('lib/route-share-card.ts'), check=read('components/routes/RouteDepartureChecklist.tsx');
ok(wa.includes("export const IFOOD_DRIVER_CONFIRMATION_URL = 'https://confirmacao-entrega-propria.ifood.com.br/'"),'URL oficial unica');
ok(wa.includes("ifoodConfirmationMode: 'store' | 'motoboy' = 'store'"),'modo legado loja por padrao');
ok((route.match(/generateRouteMessages\(route, pendingDeliveries, storeAddr, getCustomerById, getPreviousRoute\(\), ifoodConfirmationMode\)/g)||[]).length===3,'tres chamadas usam configuracao nova');
ok(route.includes('motoboys.find((m) => m.id === route.motoboy_id)'),'autoridade pelo ID de motoboy');
ok(route.includes('ifoodConfirmationMode={ifoodConfirmationMode}')&&route.includes('stops: stopPoints,\n      }, ifoodConfirmationMode)'),'checklist e imagem por motoboy');
ok(card.includes('delivery.order_index + 1 : undefined, ifoodConfirmationMode)'),'copiar cada parada com modo atual');
ok(check.includes('driverConfirmsIfood')&&check.includes('target="_blank" rel="noopener noreferrer"'),'checklist tela tem portal seguro e condicional');
ok(image.includes('driverConfirmsIfood ? 128 : 0')&&image.includes('IFOOD  /  MOTOBOY CONFIRMA'),'imagem com bloco dedicado sem sobreposicao');
ok(image.includes('pendingCodes')&&image.includes('paintDflBrand'),'identidade premium e contagem preservadas');
ok(!/\b(?:getDocs|onSnapshot|runTransaction|collection)\s*\(/.test(wa+image+check),'sem queries/listeners nos geradores');
ok(read('scripts/pre-apk.cjs').includes("'scripts/test-v112-r85-message-policy.cjs'"),'novo teste no PRE-APK');
const clipboardShim={clipboard:{writeText:async()=>{}}};
function loadTs(file,deps={}){
 const code=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok(!(code.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'TS transpile '+file);
 const mod={exports:{}};
 vm.runInNewContext(`(function(require,module,exports){${code.outputText}\n})`,{console,Date,Number,String,Math,Map,Set,Intl,navigator:clipboardShim}, {filename:file})(id=>{
  if(Object.prototype.hasOwnProperty.call(deps,id)) return deps[id];throw Error('R85 require nao previsto '+id);
 },mod,mod.exports);
 return mod.exports;
}
const codeApi=loadTs('lib/operation/ifoodOrderCode.ts');
const code=codeApi.orderConfirmationCode;
const key=d=>d.address_string||d.id;
const deps={
 '@/lib/maps':{resolveStopLocation:d=>d.address_string,buildGoogleMapsRouteUrl:()=> 'https://maps.example/rota',cleanAddressForMaps:x=>x},
 '@/lib/operational-time':{routeStartedAt:r=>r.start_time},
 '@/lib/reports/time':{firstValidTimestamp:v=>{const d=new Date(v||'');return Number.isFinite(d.getTime())?d:null;}},
 '@/lib/operational-address':{canonicalizeOperationalAddress:x=>({address:x||'',neighborhood:'Centro',observations:[]}),bestOperationalAddress:(a,b)=>a||b||'',hasHouseNumber:()=>true},
 '@/lib/route-stops':{deliveryStopKey:key,stopNumberMap:items=>new Map(items.map((d,i)=>[key(d),i+1])),groupDeliveriesByStop:items=>{const m=new Map();for(const d of items){const k=key(d);if(!m.has(k))m.set(k,[]);m.get(k).push(d)}return [...m].map(([key,rows])=>({key,representative:rows[0],deliveries:rows}));}},
 '@/lib/route-cash-flow':{routeCashFlow:()=>({cashOrders:[],initialCash:0})},
 '@/lib/route-change-plan':{buildRouteChangePlan:()=>({lines:[],flow:{initialCash:0,tenderedCash:0,plannedCashChange:0,plannedPixChange:0,expectedPhysicalReturn:0}})},
 '@/lib/delivery-finance':{deriveDeliveryPaymentState:d=>d.is_paid?'paid':'pending'},
 '@/lib/delivery-payment-split':{deliverySplitStatus:d=>{if(d.payment_splits?.length) throw Error('Legacy iFood fixture unexpectedly contains split payments');return null;}},
 '@/lib/operation/ifoodOrderCode':codeApi,
};
const msg=loadTs('lib/whatsapp.ts',deps);
const url='https://confirmacao-entrega-propria.ifood.com.br/';
const routeInput={id:'r85',name:'Rota 4',motoboy_name:'Motorista',start_time:'2026-10-23T18:30:00-03:00',change_money:0};
const make=(id,origin='ifood',confirmation_code='',address_string='Rua A, 10')=>({id,origin,customer_id:'c'+id,customer_name:'Cliente '+id,address_string,ifood_id:origin==='ifood'?'12345678':'',order_id:id,confirmation_code,customer_charge:42,route_id:'r85',is_paid:false,payment_method:'pix'});
const getCustomer=()=>undefined;
(async()=>{
 const orders=[make('1','ifood','1234'),make('2','ifood',''),make('3','loja','', 'Rua B, 22')];
 const a=await msg.generateRouteMessages(routeInput,orders,'Rua Loja, 20',getCustomer,null,'store');
 const b=await msg.generateRouteMessages(routeInput,orders,'Rua Loja, 20',getCustomer,null,'motoboy');
 ok(a.success&&b.success&&a.messages.length===3&&b.messages.length===3,'as tres mensagens foram geradas');
 ok(!a.messages.join('\n').includes(url),'loja confirma nao expõe link para motoboy');
 ok(/(?:pegar|pedir)(?:\s+o)?\s+c[oó]digo/i.test(a.messages[0]) && /(?:pegar|pedir)(?:\s+o)?\s+c[oó]digo/i.test(a.messages[1]),'loja preserva pedido do codigo tanto individual quanto na parada agrupada');
 ok(a.messages[0].includes('12345678') && a.messages[0].includes('1234'), 'loja mantem ID e codigo individual por pedido no grupo');
 ok(b.messages[0].includes(url)&&b.messages[1].includes(url),'mensagem de rota e checklist possuem link do portal');
 ok(b.messages[0].includes('12345678')&&b.messages[0].includes('1234'),'ID e codigo pertencem a cada pedido');
 ok(b.messages[1].includes('pedir código e confirmar'),'checklist agrupa sem herdar codigo do vizinho');
 ok(b.messages[0].includes('https://maps.example/rota'),'link de mapa preservado ao adicionar portal');
 ok(b.messages[2]===a.messages[2],'mensagem do dinheiro nao muda com responsavel');
 const direct=await msg.generateRouteMessages(routeInput,[make('4','loja','','Rua C, 3')],'Rua Loja, 20',getCustomer,null,'motoboy');
 ok(!direct.messages.join('\n').includes(url),'rota sem iFood nunca exibe portal');
 let copied='';
 clipboardShim.clipboard.writeText=async x=>{copied=x;};
 const copyMsg=loadTs('lib/whatsapp.ts',deps);
 ok(await copyMsg.copyDeliveryToClipboard(orders[0],'Cliente 1',undefined,[orders[0]],1,'motoboy'),'copia individual via clipboard');
 ok(copied.includes(url)&&copied.includes('12345678')&&copied.includes('1234'),'individual tem portal e ID + codigo');
 ok(await copyMsg.copyDeliveryToClipboard(orders[0],'Cliente 1',undefined,orders.slice(0,2),1,'motoboy'),'copia de parada com dois pedidos');
 ok(copied.includes(url)&&copied.includes('Cliente 1')&&copied.includes('Cliente 2')&&copied.includes('PEDIR O CÓDIGO'),'parada agrupada tem portal e codigo individual');
 ok(await copyMsg.copyDeliveryToClipboard(orders[0],'Cliente 1',undefined,orders.slice(0,2),1,'store'),'copia agrupada loja');
 ok(!copied.includes(url)&&copied.includes('PEDIR O CÓDIGO'),'loja nao recebe link agrupado');
 console.log(`R85: ${checks} verificacoes executaveis/estruturais aprovadas`);
})().catch(error=>{console.error(error);process.exitCode=1;});
