/** R66 - executa o método real de alocação em um Firestore falso transacional.
 * Isto NÃO substitui Firebase Emulator, mas testa leitura remota, atomicidade,
 * concorrência e isolamento entre Delivery e rota. */
const fs=require('fs');
const ts=require('typescript');
const source=fs.readFileSync('store/useAppStore.ts','utf8');
const a=source.indexOf('      allocateSiteDelivery: async (deliveryId, target) => {');
const b=source.indexOf('      updateDelivery: async (id, updatedData) => {',a);
if(a<0||b<0)throw Error('Metodo transacional R66 desapareceu');
const method=source.slice(a,b).trim().replace(/,\s*$/, '');
const js=ts.transpileModule('module.exports = {'+method+'};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const base={id:'site-order-v1__123',source_system:'dfl_site',external_order_id:'123',site_order_status:'confirmado',route_id:'',address_string:'Rua X, 1',fulfillment_mode:'delivery',completed:false};
const route={id:'route-a',name:'Centro',status:'aberta',operational_date:'2026-10-22',motoboy_name:'Ana'};
let count=0;
function ok(a,m){if(!a)throw Error('R66 TRANSACTION: '+m);count++}
const active=()=>({...base});
function makeFixture(remoteOverride={},routeOverride={},localDuplicates=false){
 const records=new Map([['deliveries/'+base.id,{...base,...remoteOverride}],['routes/route-a',{...route,...routeOverride}]]);
 let state={deliveries:localDuplicates?[active(),{...active(),id:'dup'}]:[active()],routes:[route],motoboys:[{id:'mb-1',name:'Ana',active:true}]};
 const locks=new Set();let committed=0,reads=0,failOnce=false;
 const doc=(db,coll,id)=>coll+'/'+id;
 const runTransaction=async(db,fn)=>{
  if(failOnce){failOnce=false;throw Error('offline');}
  const writes=[];
  const tx={get:async key=>{reads++;return{exists:()=>records.has(key),id:key.split('/').at(-1),data:()=>records.get(key)}},
    update:(key,changes)=>writes.push(['update',key,changes]),set:(key,value)=>writes.push(['set',key,value])};
  const result=await fn(tx);
  for(const [kind,key,value] of writes){records.set(key,kind==='update'?{...records.get(key),...value}:value);committed++}
  return result;
 };
 const get=()=>state;
 const set=fn=>{state={...state,...fn(state)}};
 const assertSiteRouteAllocation=(d,r,now)=>{
  if(d.source_system!=='dfl_site'||d.site_order_status!=='confirmado'||d.route_id||d.completed||!d.address_string.trim()||d.fulfillment_mode!=='delivery')throw Error('delivery nao elegivel');
  if(r && (r.status!=='aberta'||r.started_at||r.operational_date!=='2026-10-22'))throw Error('rota invalida');
 };
 const siteInboxProjection=(deliveries)=>({rows:deliveries.filter(d=>deliveries.filter(x=>x.external_order_id===d.external_order_id).length===1).map(d=>({delivery:d,state:d.site_order_status==='confirmado'&&!d.route_id?'pronto':'revisar'}))});
 const env={db:{},doc,runTransaction,get,set,siteInboxProjection,deliveryMutationLocks:locks,isSyntheticOperationalRoute:r=>r.startsWith('rota-site-'),
  dateKey:d=>'2026-10-22',assertSiteRouteAllocation,sanitizeForFirebase:x=>x};
 const out={exports:{}};
 new Function(...Object.keys(env),'module','exports',js)(...Object.values(env),out,out.exports);
 return {action:out.exports.allocateSiteDelivery,records,getState:()=>state,reads:()=>reads,committed:()=>committed,offline:()=>{failOnce=true}};
}
(async()=>{
 const a=makeFixture();const routeId=await a.action(base.id,{routeId:'route-a'});
 ok(routeId==='route-a','rota existente');ok(a.records.get('deliveries/'+base.id).route_id==='route-a','pedido unico foi atualizado');
 ok(a.committed()===1,'somente uma gravação na rota existente');ok(a.reads()===2,'read pedido e rota no Firestore');
 ok(a.getState().deliveries[0].route_id==='route-a','Zustand atualizado somente apos commit');
 const b=makeFixture({site_order_status:'cancelado'});try{await b.action(base.id,{routeId:'route-a'});throw Error('not rejected')}catch(e){ok(e.message!=='not rejected','cancelamento remoto bloqueia alocacao')}ok(b.committed()===0,'cancelamento 0 writes');
 const c=makeFixture({site_order_status:'pendente'});try{await c.action(base.id,{routeId:'route-a'});throw Error('not rejected')}catch(e){ok(e.message!=='not rejected','confirmacao tardia bloqueia')}ok(c.committed()===0,'pending 0 writes');
 const d=makeFixture({}, {started_at:'2026-10-22T21:00:00Z'});try{await d.action(base.id,{routeId:'route-a'});throw Error('not rejected')}catch(e){ok(e.message!=='not rejected','rota iniciada bloqueada')}ok(d.committed()===0,'rota iniciada 0 writes');
 const e=makeFixture();const newId=await e.action(base.id,{newRoute:{name:'Extra',motoboyId:'mb-1'}});
 ok(newId.startsWith('site-route-'),'nova rota ID proprio');ok(e.records.get('routes/'+newId).name==='Extra','nova rota criada');
 ok(e.records.get('deliveries/'+base.id).route_id===newId,'pedido alocado atomicamente');ok(e.committed()===2,'rota + pedido em uma unica transacao');
 const f=makeFixture();f.offline();try{await f.action(base.id,{routeId:'route-a'});throw Error('not rejected')}catch(e){ok(e.message==='offline','offline nao finge sucesso')}
 ok(f.committed()===0,'offline 0 writes');await f.action(base.id,{routeId:'route-a'});ok(f.committed()===1,'retry apos falha libera lock');
 const g=makeFixture({route_id:'route-a'});try{await g.action(base.id,{routeId:'route-a'});throw Error('not rejected')}catch(e){ok(e.message!=='not rejected','idempotencia sem duplicar alocacao')}
 ok(g.committed()===0,'pedido ja alocado 0 writes');
 const h=makeFixture({}, {}, true);try{await h.action(base.id,{routeId:'route-a'});throw Error('not rejected')}catch(e){ok(e.message!=='not rejected','ID externo duplicado na Caixa bloqueia')}ok(h.reads()===0 && h.committed()===0,'duplicado local bloqueia antes do Firestore');
 console.log('R66 TRANSACAO SITE/ROTA: '+count+' validacoes OK (mock, nao Emulator)');
})().catch(e=>{console.error(e);process.exitCode=1});
