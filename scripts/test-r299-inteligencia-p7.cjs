/* R299 P7 — gates herméticos: histórico, identidade, score, UI, Mais e regressões. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
const ok=(v,label)=>{assert.ok(v,'P7: '+label);console.log('OK:',label);checks++};
const eq=(a,b,label)=>{assert.deepEqual(a,b,'P7: '+label);console.log('OK:',label);checks++};
const files=[
 'types/index.ts','lib/customer-review.ts','lib/customer-review-store.ts',
 'lib/customer-intelligence.ts','components/customers/CustomerReviewPanel.tsx',
 'components/customers/CustomerRelationshipPanel.tsx','app/clientes/details/page.tsx',
 'app/clientes/page.tsx','app/clientes/inteligencia/page.tsx','app/mais/page.tsx',
 'store/useAppStore.ts','scripts/pre-apk.cjs',
];
for(const file of files){
 const src=read(file);const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS;
 const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,kind);
 ok(ast.parseDiagnostics.length===0,'AST '+file+(ast.parseDiagnostics[0]?.messageText||''));
}
function load(file,deps={}){
 const output=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',output)((id)=>{
  if(Object.hasOwn(deps,id))return deps[id];throw Error('Dependência inesperada: '+id);
 },module,module.exports);
 return module.exports;
}
const review=load('lib/customer-review.ts');
const base={state:'observacao',reason:'Telefone do pedido corrigido após contato direto',actorUid:'owner',eventId:'evt-1',occurredAt:'2026-11-08T12:00:00Z',relatedDeliveryId:'d1'};
const first=review.appendCustomerReview(base);
eq(first.events.length,1,'primeira ocorrência persistível');
eq(first.events[0].related_delivery_id,'d1','pedido associado à ocorrência');
eq(review.appendCustomerReview({...base,previous:first}),first,'reexecução idempotente não duplica evento');
const closed=review.appendCustomerReview({...base,previous:first,eventId:'evt-2',state:'revisado',reason:'Conferência feita com o destinatário e número confirmado'});
eq(closed.state,'revisado','revisão não apaga ocorrência histórica');
eq(closed.events.length,2,'histórico preservado');
assert.throws(()=>review.appendCustomerReview({...base,reason:'perigoso'}),/motivo/i);checks++;
ok(!/\b(fetch|localStorage|sessionStorage|onSnapshot)\s*\(/.test(read('lib/customer-review.ts')),'modelo puro sem rede nem cache persistente');
const store=read('lib/customer-review-store.ts');
ok(store.includes('runTransaction(db')&&store.includes('tx.get(ref)')&&store.includes('tx.update(ref'),'gravação transacional no documento do cliente');
ok(store.includes('auth.currentUser')&&store.includes('isSuperadminUid(actor.uid)'),'somente proprietário autenticado');
ok(store.includes('operational_review_server_at: serverTimestamp()'),'marco de servidor independente do relógio local');
ok(!store.includes('localStorage')&&!store.includes('setDoc('),'nenhuma gravação cliente fora da transação');
const score=load('lib/customer-relationship-score.ts');
const intel=load('lib/customer-intelligence.ts',{
 '@/lib/customer-relationship-score':score,
 '@/lib/delivery-finance':{deliveryCustomerCharge:d=>d.customer_charge??d.value??0},
});
const customer={id:'c1',name:'Cliente',operational_review:first};
const now=new Date('2026-11-08T20:00:00Z');
const order=(id,extra={})=>({id,customer_id:'c1',created_at:'2026-11-06T20:00:00Z',completed:true,customer_charge:42,payment_method:'pix',origin:'loja',...extra});
const noOrders=intel.buildCustomerIntelligence(customer,[],now);
eq(noOrders.score,null,'ausência de histórico não vira 0/100 apresentado');
eq(noOrders.tier,'Em formação','estado comercial sem compras é em formação');
const full=intel.buildCustomerIntelligence(customer,[order('1'),order('1'),order('2',{developer_test:true}),order('3',{completed:false}),order('4',{customer_charge:10,payment_method:'dinheiro'})],now);
eq(full.completed,2,'concluídos reais, sem testes e dedupe ID');
eq(full.totalCharged,52,'total e ticket calculados somente dos concluídos');
eq(full.averageTicket,26,'ticket médio derivado dos pedidos elegíveis');
eq(full.mostUsedPayment,'pix','pagamento comum usa dado observado');
ok(full.score!==null,'score existe com evidência de compra');
const ui=read('components/customers/CustomerReviewPanel.tsx');
ok(ui.includes('Somente o proprietário')&&ui.includes('recordCustomerReview')&&ui.includes('relatedDeliveryId'),'edição restrita e rastreável');
ok(ui.includes('Histórico de revisões')&&ui.includes('Em observação'),'trilha e estado separados do score');
const relation=read('components/customers/CustomerRelationshipPanel.tsx');
ok(relation.includes('value.completedOrders>0')&&relation.includes('Em formação')&&relation.includes('Como este score é calculado?'),'score vazio sem nota negativa e explicação acessível');
const customers=read('app/clientes/page.tsx');
ok(customers.includes("router.push('/clientes/inteligencia')"),'inteligência acessível por Clientes');
const details=read('app/clientes/details/page.tsx');
ok(details.includes('<CustomerReviewPanel customer={customer} deliveries={stats.deliveries}/>')&&details.includes('CustomerRelationshipPanel'),'ficha integra ambos os eixos');
const page=read('app/clientes/inteligencia/page.tsx');
ok(page.includes('isSuperadminUid(owner?.uid)')&&page.includes('buildCustomerIntelligence')&&page.includes('customerReviewLabel'),'tela consulta estado sem permissões novas');
ok(!/onSnapshot\(|getDocs\(|fetch\(|runTransaction\(/.test(page),'tela sem listener, rede ou Firestore extra');
const more=read('app/mais/page.tsx');
ok(more.includes("router.push('/mais/mensageria')")&&more.includes("router.push('/mais/acompanhamento')"),'Mensageria e tracking permanecem separados');
ok(more.includes('Inteligência de Clientes')&&!more.includes("router.push('/confirmacoes')"),'Mais sem confirmação iFood duplicada');
ok(!more.includes('Estado operacional')&&more.includes("router.push('/mais/diagnostico')"),'estado inerte removido, diagnóstico preservado');
ok(more.includes('<OperationalRadar />')&&more.includes('legacyRadarOpen &&')&&more.includes('Radar legado'),'Radar legado mantido oculto com testes preservados');
const st=read('store/useAppStore.ts');
ok(st.includes('source.operational_review?.events?.length')&&st.includes('target.operational_review?.events?.length'),'merge sem perda silenciosa da trilha');
ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r299-inteligencia-p7.cjs'"),'novo gate PRE-APK');
ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r299-integridade-site-p6.cjs'")&&read('scripts/pre-apk.cjs').includes("'scripts/test-r299-fechamento-p5.cjs'"),'cirurgias anteriores preservadas');
console.log(`R299 P7: ${checks} verificações herméticas aprovadas`);
