'use strict';
/** R266 hermetic: no network, no real Firestore, no WhatsApp. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let n=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);n++};
const ok=(actual,label)=>{assert.ok(actual,label);n++};
const read=name=>fs.readFileSync(name,'utf8');
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(
 read('lib/operation/route-departure-readiness.ts'),
 {fileName:'route-departure-readiness.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}
).outputText)((id)=>{
 if(id==='@/lib/integration/site-order')return {isCancelledSiteDelivery:delivery=>delivery.site_order_status==='Cancelado'||Boolean(delivery.operational_dismissed_at)};
 throw Error('R266 unexpected dependency: '+id);
},mod,mod.exports);
const h=mod.exports;
const delivery=(id,more={})=>({id,route_id:'route1',order_index:id==='d1'?0:1,customer_id:'c'+id,
 address_string:'Rua '+id,source_system:'dfl_entregas',origin:'loja',completed:false,updated_at:'2026-11-05T11:00:00Z',...more});
const route={id:'route1',status:'aberta',motoboy_id:'m1',motoboy_name:'Entregador',updated_at:'2026-11-05T11:00:00Z'};
const members=[delivery('d1'),delivery('d2')];
const sig=h.routeDepartureSignature(route,members);
ok(/^r266-v1-2-[a-f0-9]{16}$/.test(sig),'signature format stable and bounded');
eq(h.routeDepartureSignature(route,[members[1],members[0]]),sig,'array order does not affect operational order');
const ready={...route,departure_ready_at:'2026-11-05T11:01:00Z',departure_ready_signature:sig,departure_ready_count:2};
eq(h.isRouteDepartureReady(ready,members),true,'confirmed route is ready');
eq(h.routeDepartureNeedsReview(ready,members),false,'no false review');
for(const [label,data] of [
 ['new delivery',[...members,delivery('d3')]],
 ['changed address',[{...members[0],address_string:'Outro local'},members[1]]],
 ['changed order',[{...members[0],order_index:9},members[1]]],
 ['changed confirmation',[{...members[0],site_order_status:'Em Produção'},members[1]]],
 ['completed one',[{...members[0],completed:true},members[1]]],
 ['changed destination',[{...members[0],customer_id:'novo'},members[1]]],
 ['updated delivery timestamp',[{...members[0],updated_at:'2026-11-05T11:04:00Z'},members[1]]],
 ['urgent changed',[{...members[0],is_urgent:true},members[1]]],
]){eq(h.isRouteDepartureReady(ready,data),false,label+' invalidates ready');eq(h.routeDepartureNeedsReview(ready,data),true,label+' forces review')}
eq(h.isRouteDepartureReady({...ready,motoboy_id:'m2'},members),false,'courier change invalidates');
eq(h.isRouteDepartureReady({...ready,departure_ready_count:1},members),false,'count mismatch invalidates');
eq(h.isRouteDepartureReady({...ready,started_at:'2026-11-05T11:03:00Z'},members),false,'dispatch supersedes ready');
eq(h.isRouteDepartureReady({...ready,status:'fechada'},members),false,'closed route not ready');
eq(h.routeDepartureNeedsReview({...ready,started_at:'2026-11-05T11:03:00Z'},members),false,'dispatch does not require recheck');
eq(h.isRouteDepartureReady({...ready,departure_ready_at:null},members),false,'revoked readiness not shown');
eq(h.routeDepartureSignature(route,[delivery('d1',{fulfillment_mode:'pickup'})]),null,'pickup not part of route departure');
eq(h.routeDepartureSignature(route,[delivery('d1',{origin:'loja',site_order_status:'Cancelado'})]),null,'cancelled excluded');
eq(h.routeDepartureSignature(route,[delivery('d1',{operational_dismissed_at:'2026-11-05T11:00:00Z'})]),null,'dismissed excluded');
eq(h.routeDepartureSignature(route,[delivery('d1',{fulfillment_mode:'external_delivery'})]),null,'external platform delivery excluded');
const store=read('store/useAppStore.ts');
const ui=read('app/rotas/details/page.tsx');
const home=read('components/home/RouteAccordion.tsx');
const listing=read('app/rotas/page.tsx');
const contract=read('lib/tracking/gate1/core.ts');
const pre=read('scripts/pre-apk.cjs');
const types=read('types/index.ts');
for(const field of ['departure_ready_at','departure_ready_signature','departure_ready_revision','departure_ready_revoked_at'])ok(types.includes(field),'route model field '+field);
ok(store.includes("setRouteDepartureReady: async (routeId, ready) =>"),'single store action');
ok(store.includes("await queueEntityWrite('routes', routeId, () => runTransaction(db"),'server transactional write serialized');
ok(store.includes("if ((remote.updated_at || null) !== expectedUpdate)"),'stale route guard');
ok(store.includes("!isRouteDepartureReady(current, routeDeliveries)"),'dispatch guard after ready becomes stale');
ok(store.includes("if (!get().user?.uid)"),'requires authenticated operator');
ok(!store.includes('notifyRouteReady'),'no new message trigger');
ok(ui.includes('Marcar rota pronta para sair'),'details action');
ok(ui.includes('Reconfirmar rota pronta'),'details recheck');
ok(ui.includes('Voltar para montagem'),'details undo');
ok(home.includes('Marcar rota pronta'),'home action');
ok(home.includes('Conferência precisa ser refeita'),'home stale state');
ok(listing.includes("'pronta-saida'"),'distinct filter for ready-to-depart');
ok(listing.includes('Para finalizar'),'existing finish-ready status still distinct');
ok(pre.includes('scripts/test-r265-link-handoff.cjs'),'R265 tests preserved');
eq(pre.split('scripts/test-r266-route-departure.cjs').length-1,1,'R266 test registered exactly once');
ok(!contract.includes('route_ready_for_departure'),'no public tracking event before joint certification');
console.log(`R266: ${n} hermetic checks PASS; no network/Firestore/WhatsApp.`);
