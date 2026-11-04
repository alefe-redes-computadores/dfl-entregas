'use strict';
/** DFL R245 Busca 360 — contratos locais e de UX, sem alterar Firestore/WhatsApp. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
let count=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);count++;};
const yes=(v,msg)=>{assert.ok(v,msg);count++;};
const no=(v,msg)=>{assert.ok(!v,msg);count++;};
const read=p=>fs.readFileSync(p,'utf8');
function load(name,overrides={}) {
  const input=read(name),parsed=ts.createSourceFile(name,input,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
  eq(parsed.parseDiagnostics.length,0,`${name} sem erro de parse`);
  const out=ts.transpileModule(input,{fileName:name,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  eq((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${name} sem diagnóstico TS`);
  const mod=new Module(name,module);mod.filename=`${process.cwd()}/${name}`;mod.paths=module.paths;
  mod.require=id=>Object.prototype.hasOwnProperty.call(overrides,id)?overrides[id]:require(id);
  mod._compile(out.outputText,mod.filename);return mod.exports;
}
const normalize=load('lib/operation/searchR99.ts');
const m=load('lib/operation/assistant-search-premium.ts',{'@/lib/operation/searchR99':normalize});
for(const [q,h,min,around] of [
 ['Pedidos às 15:00',15,0,false],['pedidos as 15h',15,0,false],
 ['Pedidos por volta das 19:30',19,30,true],['pedidos perto das 00:05',0,5,true],
 ['às 9',9,0,false],['pedidos 23:59',23,59,false],['15:00',15,0,false],
]) {
 const parsed=m.parseAssistantTimeIntent(q);yes(parsed,q+' reconhecido');eq([parsed.hour,parsed.minute,parsed.around],[h,min,around],q+' preciso');
}
for(const bad of ['Pedido 845211','15:99','25:00','pedido 3000','', 'as 24h'])eq(m.parseAssistantTimeIntent(bad),null,`não confundir ${bad}`);
eq(m.assistantSearchCategory('PEDIDOS do site'),'delivery');
eq(m.assistantSearchCategory('motoboy Bruno'),'motoboy');
eq(m.assistantSearchCategory('rota Azul'),'route');
eq(m.assistantSearchCategory('produto bacon'),'stock');
eq(m.assistantSearchCategory('cliente João'),'customer');
eq(m.assistantSearchCategory('alho'),null);
eq(m.assistantSearchTerms('Pedidos às 15:00'),'');
eq(m.assistantSearchTerms('Buscar bacon no estoque'),'bacon');
eq(m.assistantSearchTerms('Pedido 845211'),'845211');
eq(m.assistantSearchTerms('Cliente João'),'joao');
const delivery=(id,order,created,name='João Silva',address='Rua Dezesseis, 10')=>({id,order_id:order,customer_id:'c-1',customer_name:name,address_string:address,created_at:created,route_id:'',completed:false});
const data={
 deliveries:[
  delivery('d-1','845211','2026-11-03T18:00:00.000Z'),
  delivery('d-2','845212','2026-11-03T18:11:00.000Z','João Silva'),
  delivery('d-3','845213','2026-11-03T19:00:00.000Z','Maria Santos'),
  delivery('d-4','845214',undefined,'Sem horário'),
 ],
 customers:[{id:'c-1',name:'João Silva',phone:'34999999999',address:'Rua Dezesseis, 10'}, {id:'c-2',name:'João Silva',phone:'34988888888'}],
 routes:[{id:'r-1',name:'Rota Azul',motoboy_name:'Bruno'},{id:'r-2',name:'Rota Centro',motoboy_name:'Maria'}],
 products:[{id:'p-1',name:'Bacon',category:'Carnes',barcode:'789123',active:true},{id:'p-2',name:'Bacon defumado',category:'Carnes',active:true},{id:'p-3',name:'Bacon antigo',active:false}],
 motoboys:[{id:'m-1',name:'Bruno',active:true},{id:'m-2',name:'Maria',active:false}],
};
const before=JSON.stringify(data);
const result=(query,limit=12)=>m.searchAssistantSnapshotPremium(query,data,limit);
const order=result('845211');eq(order[0].id,'delivery:d-1');eq(order[0].kind,'delivery');yes(order[0].href.includes('d-1'),'abrir a entrega certa');
const typed=result('pedido do João');yes(typed.length>=2,'clientes iguais preservam pedidos individuais');yes(typed.every(x=>x.kind==='delivery'),'intenção pedido só mostra entregas');
eq(result('cliente João').length,2,'clientes homônimos aparecem individualmente');yes(result('cliente João').every(x=>x.href.startsWith('/clientes/details?id=')),'navegação cliente direta');
eq(result('motoboy Bruno')[0].id,'motoboy:m-1');eq(result('motoboy Maria')[0].detail,'Motoboy inativo');
eq(result('rota Azul')[0].id,'route:r-1');
eq(result('Bacon no estoque').length,2,'estoque ignora inativo');
eq(result('Bacon no estoque')[0].kind,'stock');
eq(result('789123')[0].id,'stock:p-1','código de barras priorizado');
eq(result('pedido Rua Dezesseis')[0].kind,'delivery','endereço pesquisável em pedidos');
eq(result('Pedidos às 15:00').map(x=>x.id),['delivery:d-1'],'15:00 exato, São Paulo');
eq(result('Pedidos por volta das 15:00').map(x=>x.id).sort(),['delivery:d-1','delivery:d-2'],'janela de 15 min');
eq(result('Pedidos às 16:00').map(x=>x.id),['delivery:d-3'],'16:00 horário correto');
eq(result('Pedidos às 21:00'),[],'sem dados não inventa');
eq(result('Pedidos às 15:00',0),[],'limite zero');
eq(result('845211',-4),[],'limite negativo');
const oversized=result('Bacon no estoque',1);eq(oversized.length,1,'limite respeitado');
eq(result('Bacon no estoque',Infinity),[],'limite inválido não consulta tudo');
eq(result('Pedidos às 15:00')[0].detail.includes('15:00'),true,'horário exibido no card');
const special={...data,customers:[],routes:[],products:[],motoboys:[],deliveries:[delivery('site/order#1','42','2026-11-03T18:00:00.000Z','Fulano','Rua muito longa '.repeat(50))]};
const found=m.searchAssistantSnapshotPremium('pedido 42',special,1)[0];yes(found.href.includes('site%2Forder%231'),'ID é codificado sem rota inválida');yes(found.detail.length<=170,'endereço longo não extrapola resumo');
eq(m.localOrderClock('2026-11-03T18:00:00.000Z').minuteOfDay,900,'timezone SP');
eq(m.localOrderClock(undefined),null,'sem data retorna nulo');
eq(m.localOrderClock('2026-11-03'),null,'data sem relógio não vira hora');
eq(m.localOrderClock('2026-11-03T15:00:00'),null,'timestamp sem fuso não inventa horário São Paulo');
eq(m.localOrderClock('invalid'),null,'timestamp inválido não cria hora');
eq(m.localOrderClock('2026-11-03T20:59:00Z').minuteOfDay,17*60+59,'minuto preservado');
eq(m.searchAssistantSnapshotPremium('pedido 845211',data,1).length,1,'busca síncrona do texto atual');
eq(JSON.stringify(data),before,'nenhuma entidade foi alterada');
eq(m.resolveAssistantEnter('Pedido 845211',result('Pedido 845211'),'/entregas').state,'match','ID exato abre ficha antes de rota genérica');
eq(m.resolveAssistantEnter('cliente João',result('cliente João'),'/entregas').state,'choose','homônimos não escolhem cadastro arbitrário');
eq(m.resolveAssistantEnter('Pedidos por volta das 15:00',result('Pedidos por volta das 15:00')).state,'choose','vários pedidos no horário não escolhem arbitrariamente');
eq(m.resolveAssistantEnter('Pedidos às 15:00',result('Pedidos às 15:00')).href,'/entregas/details?id=d-1','horário único abre pedido');
eq(m.resolveAssistantEnter('Compras',[],'/estoque/compras').state,'destination','comando sem registro abre seção');
eq(m.resolveAssistantEnter('nada',[]).state,'none','sem dados retorna neutro');
for (let i=0;i<8;i++){
  const examples=m.assistantSessionExamples(i);
  eq(examples.length,4,'quatro sugestões por sessão '+i);
  eq(new Set(examples).size,4,'sem repetição no mesmo painel '+i);
  yes(examples.every(x=>typeof x==='string' && x.length>3),'exemplos legíveis '+i);
}
no(JSON.stringify(m.assistantSessionExamples(0))===JSON.stringify(m.assistantSessionExamples(1)),'sessões alternam exemplos');
const live=read('components/assistant/GlobalAssistantPalette.tsx');
const home=read('components/home/OperationalAssistant.tsx');
const pre=read('scripts/pre-apk.cjs');
for (const token of ['searchAssistantSnapshotPremium','parseAssistantTimeIntent','assistantSessionExamples','resolveAssistantEnter','setKindFilter','useDeferredValue','role="dialog"','aria-modal="true"','privacy ? []','role="search"','router.push(href)']) yes(live.includes(token),'Global tem '+token);
for (const token of ['searchAssistantSnapshotPremium','parseAssistantTimeIntent','examplesForSession','resolveAssistantEnter','useDeferredValue','privacy ? []','hideForToday','const typed = value.trim()']) yes(home.includes(token),'Home tem '+token);
for(const p of ['lib/operation/assistant-search-premium.ts','components/assistant/GlobalAssistantPalette.tsx','components/home/OperationalAssistant.tsx']){
 const content=read(p);
 no(content.includes('fetch(')||content.includes('onSnapshot(')||content.includes('runTransaction(')||content.includes('addDoc('),p+' sem I/O remoto');
 const syntactic=ts.transpileModule(content,{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 eq((syntactic.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,p+' sintaxe TS sem erros');
}
no(live.includes('useState(() => Math.floor(Math.random()'),'SSR não sorteia exemplo no render Global');
no(home.includes('useState(() => Math.floor(Math.random()'),'SSR não sorteia exemplo no render Home');
no(live.includes('localStorage.setItem('),'Busca não salva texto livre');
no(home.includes('localStorage.setItem('),'Home não salva texto livre');
yes(pre.includes("'scripts/test-r245-search360-premium.cjs'"),'nova suíte no PRE-APK');
yes(pre.includes("'scripts/test-r244-site-combo-v3-dispatch-simulation.cjs'"),'R244 mantida');
yes(pre.includes("'scripts/test-r243-site-combo-v3-certification.cjs'"),'R243 mantida');
yes(pre.includes("'scripts/test-r237-assistant-global.cjs'"),'R237 mantida');
console.log(`R245 BUSCA 360 PREMIUM: ${count} verificações aprovadas; local, offline, sem gravação.`);
