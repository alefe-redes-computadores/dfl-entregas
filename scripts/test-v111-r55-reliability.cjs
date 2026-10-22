const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
let checks=0;
const check=(label,fn)=>{fn();checks++;console.log('✓',label);};
function compile(file,overrides={}) {
 const source=fs.readFileSync(file,'utf8');
 const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const context={exports:{},require:(name)=>name in overrides?overrides[name]:require(name),console,Date,Set,Number};
 vm.runInNewContext(result.outputText,context,{filename:file,timeout:4000});
 return context.exports;
}
const {relayStageSucceeded,recoveryCheckpointEligible}=compile('lib/integration/worker-health.ts');
const payload=(failed,unsettled,ok=true)=>({ok:true,value:{ok,failed,unsettled}});
for(const val of [1,2,100,-1,Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY,'0',null]) {
 const expected=val===null;
 check(`relay pendências ${String(val)} sem falso sucesso`,()=>assert.equal(relayStageSucceeded(payload(0,val)),expected));
}
for(const val of [1,2,-1,Number.NaN,Number.POSITIVE_INFINITY,'0']) {
 check(`relay failed ${String(val)} sem falso sucesso`,()=>assert.equal(relayStageSucceeded(payload(val,0)),false));
}
check('relay normal concluído',()=>assert.equal(relayStageSucceeded(payload(0,0)),true));
check('relay legado sem contadores continua compatível',()=>assert.equal(relayStageSucceeded({ok:true,value:{ok:true}}),true));
check('relay sem operação pode estar vazio',()=>assert.equal(relayStageSucceeded(null),true));
check('relay com erro de execução bloqueia',()=>assert.equal(relayStageSucceeded({ok:false,error:'offline'}),false));
check('ok:false do negócio bloqueia',()=>assert.equal(relayStageSucceeded(payload(0,0,false)),false));
for(let failed=0;failed<=6;failed++)for(let unsettled=0;unsettled<=6;unsettled++) {
 check(`matriz ${failed}/${unsettled}`,()=>assert.equal(relayStageSucceeded(payload(failed,unsettled)),failed===0&&unsettled===0));
}
const recovery=(ids)=>({ok:true,value:{ok:true,statusRecoveryReplayEnabled:true,statusRecoveryReplayRead:ids.length,statusRecoveryReplayEventIds:ids}});
check('replay vazio sem relay pode concluir',()=>assert.equal(recoveryCheckpointEligible(recovery([]),null,40),true));
check('replay com pendência não conclui',()=>assert.equal(recoveryCheckpointEligible(recovery(['a']),payload(0,1),40),false));
check('replay com aceite pode concluir',()=>assert.equal(recoveryCheckpointEligible(recovery(['a']),payload(0,0),40),true));
check('replay sem relay é incompleto',()=>assert.equal(recoveryCheckpointEligible(recovery(['a']),null,40),false));
check('replay página completa é incompleto',()=>assert.equal(recoveryCheckpointEligible(recovery(Array(40).fill('a')),payload(0,0),40),false));
const watcherSource='components/SiteOrderNotificationWatcher.tsx';
function watcherScenario({initialUnread=[],source='dfl_site',status='pendente',user=true,repeat=false}={}) {
 const unread=new Set(initialUnread),marked=[],notified=[];
 let receive=()=>{};let subscriptions=0;
 const useStore=(select)=>select({user:user?{uid:'owner'}:null,authLoaded:true,hasHydrated:true});
 useStore.getState=()=>({customers:[{id:'c',name:'Cliente'}],storeSettings:{notificationPreferences:{}}});
 const React={useEffect:(callback)=>{const clean=callback();if(typeof clean==='function'){} }};
 const exports=compile(watcherSource,{
  react:React,'firebase/firestore':{collection:()=>({}),query:()=>({}),where:()=>({}),onSnapshot:(q,cb)=>{subscriptions++;receive=cb;return ()=>{};}},
  '@/lib/firebase':{db:{}},'@/store/useAppStore':{useAppStore:useStore},
  '@/lib/site-order-inbox':{readUnreadSiteOrderIds:()=>[...unread],markUnreadSiteOrders:ids=>{marked.push(...ids);ids.forEach(id=>unread.add(id));}},
  '@/lib/native/notifications':{notifyNewSiteOrder:(id)=>{notified.push(id);return Promise.resolve(true);}},
 });
 exports.SiteOrderNotificationWatcher();
 const item={type:'added',doc:{id:'doc-1',data:()=>({id:'pedido-1',customer_id:'c',source_system:source,site_order_status:status})}};
 if(user) {receive({docChanges:()=>[item]});if(repeat)receive({docChanges:()=>[item]});}
 return {unread:[...unread],marked,notified,subscriptions};
}
check('pedido novo gera badge e uma notificação',()=>{const r=watcherScenario();assert.deepEqual(r.notified,['pedido-1']);assert.deepEqual(r.unread,['pedido-1']);assert.equal(r.subscriptions,1);});
check('pedido já marcado não repete notificação',()=>{const r=watcherScenario({initialUnread:['pedido-1']});assert.deepEqual(r.notified,[]);assert.deepEqual(r.unread,['pedido-1']);});
check('mesma emissão não duplica',()=>{const r=watcherScenario({repeat:true});assert.deepEqual(r.notified,['pedido-1']);});
check('pedido iFood não gera alerta de Site',()=>{const r=watcherScenario({source:'ifood'});assert.deepEqual(r.notified,[]);});
check('pedido cancelado não gera novo alerta',()=>{const r=watcherScenario({status:'cancelado'});assert.deepEqual(r.notified,[]);});
check('sem usuário não instala listener',()=>{const r=watcherScenario({user:false});assert.equal(r.subscriptions,0);});
console.log(`R55 RELIABILITY BEHAVIOR: ${checks} verificações aprovadas.`);
