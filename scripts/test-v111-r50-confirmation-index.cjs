const assert=require('assert');
const fs=require('fs');
const Module=require('module');
const ts=require('typescript');
const source=fs.readFileSync('lib/ifood-confirmation-index.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helper=new Module('r50-index');helper.filename=__filename;helper.paths=module.paths;helper._compile(compiled,__filename);
const {buildConfirmationIndexes}=helper.exports;
let cases=0;
let seed=50913;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const pick=arr=>arr[Math.floor(rand()*arr.length)];
const digits=x=>(x||'').replace(/\D/g,'');
const oldFind=(rows,ifoodId,orderId)=>rows.find(d=>(digits(ifoodId)&&digits(d.ifood_id)===digits(ifoodId))||(digits(orderId)&&digits(d.order_id)===digits(orderId)));
for(let i=0;i<200;i++){
 const deliveries=Array.from({length:60},(_,n)=>({id:`d-${n}`,customer_id:'c-'+(n%7),route_id:'r-'+(n%4),order_id:String(Math.floor(rand()*25)+2000),ifood_id:String(Math.floor(rand()*28)+10000000)}));
 const customers=Array.from({length:7},(_,n)=>({id:'c-'+n,name:'Pessoa '+n}));
 const routes=Array.from({length:4},(_,n)=>({id:'r-'+n,name:'Rota '+n}));
 const index=buildConfirmationIndexes(deliveries,customers,routes);
 for(let n=0;n<40;n++){
  const d=pick(deliveries);const o=pick(deliveries);
  const ifood=n%3===0?'':d.ifood_id;
  const order=n%4===0?'':o.order_id;
  assert.equal(index.findLinkedDelivery(ifood,order),oldFind(deliveries,ifood,order));cases++;
 }
 assert.equal(index.customersById.get('c-3').name,'Pessoa 3');cases++;
 assert.equal(index.routesById.get('r-2').name,'Rota 2');cases++;
 assert.equal(index.deliveriesById.get('d-12').id,'d-12');cases++;
}
// Escala sem produto cartesiano: 40k entregas, 2k consultas, todos indexados.
const huge=Array.from({length:40000},(_,i)=>({id:'x'+i,ifood_id:String(12000000+i),order_id:String(10000+i)}));
const big=buildConfirmationIndexes(huge,[],[]);
for(let i=0;i<2000;i++){const pos=Math.floor(rand()*40000);assert.equal(big.findLinkedDelivery(huge[pos].ifood_id)?.id,huge[pos].id);cases++}
// Eventos duplicados: conserva primeira ocorrência por identidade e sequência.
const same=[{id:'one',order_id:'3000',ifood_id:'12345678'},{id:'two',order_id:'3000',ifood_id:'87654321'}];
assert.equal(buildConfirmationIndexes(same,[],[]).findLinkedDelivery('87654321','3000').id,'one');cases++;
// A regra operacional usa apenas o código do pedido: histórico do cliente não é prova.
const confirmationTs=ts.transpileModule(fs.readFileSync('lib/ifood-confirmations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const confirmationModule=new Module('r50-confirmation');confirmationModule.filename=__filename;confirmationModule.paths=module.paths;
// Testa o módulo real com seu helper, mesmo fora do resolvedor @/ do Next.
const codeTs=ts.transpileModule(fs.readFileSync('lib/operation/ifoodOrderCode.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const codeModule=new Module('r50-code');codeModule.filename=__filename;codeModule.paths=module.paths;codeModule._compile(codeTs,__filename);
const originalRequire=confirmationModule.require.bind(confirmationModule);
confirmationModule.require=(name)=>name==='@/lib/operation/ifoodOrderCode' ? codeModule.exports : originalRequire(name);
confirmationModule._compile(confirmationTs,__filename);
const get=confirmationModule.exports.getIfoodConfirmationInfo;
assert.equal(get({origin:'ifood',ifood_id:'12345678'}, undefined).state,'missing_code');cases++;
assert.equal(get({origin:'ifood',ifood_id:'12345678',confirmation_code:'5678'}, undefined).state,'ready');cases++;
assert.equal(get({origin:'ifood',ifood_id:'12345678'}, {last_confirmation_code:'1234'}).state,'missing_code');cases++;
assert.equal(get({origin:'ifood',ifood_id:'12345678'}, {last_confirmation_code:'1234'}).codeSource,'none');cases++;
assert.equal(get({origin:'ifood',ifood_id:'12345678',confirmation_code:'12345'}).state,'missing_code');cases++;
// Mesmo que um futuro chamador passe o cliente, o histórico nunca autoriza outro pedido.
console.log('R50 CONFIRMATION INDEX:',cases,'behavior comparisons OK');
