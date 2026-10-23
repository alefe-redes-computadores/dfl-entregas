/* DFL R73 — contratos de cirurgia + execucao de motores puros */
'use strict';
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const read = (f) => fs.readFileSync(f, 'utf8');
const tests = [];
function check(name, pass) { assert.ok(pass, name); tests.push(name); }
function moduleTS(path, mocked = {}) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: path,
  }).outputText;
  const module = {exports:{}};
  const sandbox = {module, exports:module.exports, require: (key) => {
    if (mocked[key]) return mocked[key];
    throw new Error(`Dependência não simulada: ${key}`);
  }, Map, Set, Promise, console, Date, Number, String, Boolean};
  vm.runInNewContext(code, sandbox, {filename:path});
  return module.exports;
}
(async () => {
  const guard = moduleTS('lib/route-order-write-guard.ts');
  const steps=[];
  let release;
  const first=guard.withRouteOrderWriteLock('r1', async()=>{steps.push('start1');await new Promise(r=>release=r);steps.push('end1')});
  const second=guard.withRouteOrderWriteLock('r1', async()=>{steps.push('start2')});
  await Promise.resolve(); await Promise.resolve();
  check('segunda escrita espera primeira, sem erro artificial', !steps.includes('start2'));
  release(); await Promise.all([first,second]);
  check('fila efetiva e ordenada', steps.join(',') === 'start1,end1,start2');
  await assert.rejects(guard.withRouteOrderWriteLock('r1', async()=>{throw new Error('offline')}));
  const next=await guard.withRouteOrderWriteLock('r1',async()=>42);
  check('falha não bloqueia tentativas seguintes', next === 42);
  const stops=moduleTS('lib/route-stops.ts', {
    '@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},
    '@/lib/operational-address':{canonicalizeOperationalAddress:(value)=>({address:value||''})},
    '@/lib/customer-identity':{normalizeCustomerAddress:(value)=>String(value||'').toLowerCase().trim()},
  });
  const d=(id,n,locked=false)=>({id,route_id:'r1',address_string:`Rua ${id}, ${n}`,order_index:n,completed:false,order_locked:locked});
  const a=d('a',0,true), b=d('b',1), c=d('c',2);
  check('fixada no início não move com outras', stops.keepPinnedStopPositions([a,b,c],['c','b','a']).join(',')==='a,c,b');
  check('sem fixações respeita pedido', stops.keepPinnedStopPositions([b,c],['c','b']).join(',')==='c,b');
  const g1={...d('g1',0,true),address_string:'Rua 1, 10'},g2={...d('g2',0),address_string:'Rua 1, 10'},g3=d('g3',1);
  check('parada multipedido fixada é atômica', stops.keepPinnedStopPositions([g1,g2,g3],['g3','g2','g1']).join(',')==='g1,g2,g3');
  const store=read('store/useAppStore.ts');
  check('urgência trava na criação unitária',store.includes('order_locked: delivery.is_urgent ? true : delivery.order_locked'));
  check('gravação final respeita fixação',store.includes('keepPinnedStopPositions(pending, finalPendingIds)'));
  check('urgência em lote usa cabeçalho da rota',store.includes("routeHead.set(delivery.route_id, nextIndex)"));
  check('urgência na edição ganha topo e trava',store.includes('const urgentPlacementNeeded = Boolean(')&&store.includes('order_index: urgentTopIndex,'));
  const card=read('components/home/DeliveryCard.tsx');
  check('fixação independente de múltiplas paradas', card.includes('!isExpanded && canManageStop'));
  check('fixação acessível no card expandido',card.includes('onClick={(event)=>void toggleStopLock(event)}'));
  check('arraste de fixada explica destravamento',card.includes('Destrave esta parada antes de mudar'));
  const page=read('app/entregas/nova/page.tsx');
  check('segundo pedido inicia sem herdar nome',page.includes("setSameStopIdentityMode('new');"));
  check('identidade exige escolha explícita',page.includes('Mesmo cliente')&&page.includes('Outro cliente'));
  const route=read('components/home/RouteAccordion.tsx');
  check('checklist sem e com imagem',route.includes('Somente texto')&&route.includes('Checklist com imagem'));
  check('dinheiro existe quando há caixa físico',route.includes('hasPhysicalCash && <button'));
  console.log(`✓ R73 R3 — ${tests.length} contratos aprovados`);
})().catch(e=>{console.error(e);process.exitCode=1});
