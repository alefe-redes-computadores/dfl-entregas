#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('typescript');
let total=0;
const ok=(value,message)=>{assert.ok(value,'R89: '+message); console.log('OK R89:',message);total++};
const read=(name)=>fs.readFileSync(name,'utf8');
const parse=(name)=>{
  const file=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  ok(file.parseDiagnostics.length===0,`AST ${name}`);
  return read(name);
};
for(const name of [
  'lib/delivery-intelligence/cachedOperationalIntelligence.ts',
  'hooks/useDeliveryIntelligence.ts',
  'hooks/useOptimizedDeliveries.ts',
  'components/home/OperationalRadar.tsx',
])parse(name);
function load(name,stubs,clock){
  const code=ts.transpileModule(read(name),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};
  class TestDate extends Date {static now(){return clock ? clock() : Date.now();}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date:TestDate},{filename:name})(id=>{
    if(!Object.prototype.hasOwnProperty.call(stubs,id))throw Error('R89 stub ausente '+id);
    return stubs[id];
  },mod,mod.exports);
  return mod.exports;
}
let builds=0;
let currentTime=1000;
const cache=load('lib/delivery-intelligence/cachedOperationalIntelligence.ts',{
  '@/lib/delivery-intelligence':{buildOperationalIntelligence:(input)=>({generation:++builds,deliveryCount:input.deliveries.length})},
},()=>currentTime);
const base={deliveries:[{id:'1'}],routes:[{id:'r1'}],customers:[{id:'c1'}],motoboys:[{id:'m1'}],stockSupplies:[],lookbackDays:90,minimumSample:3};
const original=cache.cachedOperationalIntelligence(base);
ok(builds===1,'primeiro acesso calcula inteligencia');
ok(cache.cachedOperationalIntelligence({...base})===original && builds===1,'componentes distintos compartilham mesmo resultado');
const timed=cache.cachedOperationalIntelligence({...base,now:new Date('2026-10-23T22:00:00Z')});
ok(timed!==original && builds===2,'tempo explicito preserva historico independente');
const differentWindow=cache.cachedOperationalIntelligence({...base,lookbackDays:30});
ok(differentWindow!==original && builds===3,'janela historica independente');
const differentRoutes=cache.cachedOperationalIntelligence({...base,routes:[...base.routes]});
ok(differentRoutes!==original && builds===4,'troca de rotas invalida cache');
const differentDeliveries=cache.cachedOperationalIntelligence({...base,deliveries:[...base.deliveries]});
ok(differentDeliveries!==original && builds===5,'nova versao de entregas invalida cache');
const differentCustomers=cache.cachedOperationalIntelligence({...base,customers:[...base.customers]});
ok(differentCustomers!==original && builds===6,'cadastros atualizados invalidam cache');
const differentMotoboys=cache.cachedOperationalIntelligence({...base,motoboys:[...base.motoboys]});
ok(differentMotoboys!==original && builds===7,'mudanca de motoboy invalida cache');
const differentStock=cache.cachedOperationalIntelligence({...base,stockSupplies:[...base.stockSupplies]});
ok(differentStock!==original && builds===8,'mudanca de estoque invalida cache');
currentTime+=61000;
ok(cache.cachedOperationalIntelligence({...base})!==original && builds===9,'TTL impede inteligencia antiga');
const hook=read('hooks/useDeliveryIntelligence.ts');
ok(hook.includes('cachedOperationalIntelligence({')&&hook.includes('selectOperationalHighlights(snapshot.insights'),'hook preserva selecao/limites do radar');
const counters=load('hooks/useOptimizedDeliveries.ts',{
  react:{useMemo:(fn)=>fn()},
  '@/lib/route-intelligence':{deliveryPoint:()=>null,neighborMetadata:()=>[]},
  '@/lib/route-stops':{groupDeliveriesByStop:(items)=>items.map(item=>({key:item.id,representative:item,deliveries:[item],pending:item.completed?[]:[item],completed:item.completed?[item]:[]}))},
});
let fallbackReads=0;
const records=[{id:'d1',customer_id:'c1',address_string:'Rua A, 11',completed:false},{id:'d2',customer_id:'c1',address_string:'Rua A, 11',completed:true},{id:'d3',customer_id:'c2',address_string:'Rua B, 20',completed:false}];
const optimized=counters.useOptimizedDeliveries(records,()=>{fallbackReads++;return {id:'c2',neighborhood:'Centro',address:'Rua B, 20'}},[{id:'c1',neighborhood:'Centro',address:'Rua A, 11'}]);
ok(optimized.neighborhoodCounts.centro===3,'bairros preservados em uma passagem');
ok(optimized.addressCounts['rua a, 11']===2&&optimized.addressCounts['rua b, 20']===1,'contagem de endereco preservada');
ok(fallbackReads===2,'contagem unica + geografia preservada sem segunda varredura');
ok(optimized.pendingDeliveries.length===2&&optimized.sortedDeliveries.length===3,'pendencias e sequencia preservadas');
const optimizedSrc=read('hooks/useOptimizedDeliveries.ts');
ok(optimizedSrc.includes('for (const delivery of deliveries)')&&!optimizedSrc.includes('const addressCounts = deliveries.reduce'),'contagem nao repete varredura de clientes');
const radar=read('components/home/OperationalRadar.tsx');
const first=radar.indexOf('export function OperationalRadar()');
const second=radar.indexOf('function OperationalRadarActive(');
ok(first>=0&&second>first,'radar tem wrapper leve para silencio');
const wrapper=radar.slice(first,second);
ok(wrapper.includes('if (mutedToday) return null;')&&!wrapper.includes('useDeliveryIntelligence('),'radar silenciado nao chama motor');
ok(radar.includes('hideForToday(signal.id)')&&radar.includes('muteForToday'),'controles de ocultar e silenciar preservados');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-v112-r89-performance.cjs'")&&pre.includes("'scripts/test-v112-r88-home-settlement.cjs'"),'R89 e R88 no pre-APK');
ok(!/\b(getDocs|onSnapshot|collection|query)\s*\(/.test([read('lib/delivery-intelligence/cachedOperationalIntelligence.ts'),hook,optimizedSrc,radar].join('\n')),'nenhuma nova leitura Firestore');
console.log(`V112 R89 PERFORMANCE: ${total} contratos aprovados`);
