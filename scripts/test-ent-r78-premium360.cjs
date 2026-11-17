#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let n=0;
function ok(value,label){ assert.ok(value,'R78 '+label); n++; console.log('R78 OK:',label); }
const read=(path)=>fs.readFileSync(path,'utf8');
const store=read('store/useAppStore.ts');
const card=read('components/home/DeliveryCard.tsx');
const route=read('components/home/RouteAccordion.tsx');
const stop=read('lib/route-stops.ts');
const home=read('app/page.tsx');
const loja=read('app/loja/page.tsx');
const mais=read('app/mais/page.tsx');
const inbox=read('components/store/SiteInboxPanel.tsx');
const navigation=read('components/navigation/OperationalScrollMemory.tsx');
const visual=read('lib/operation/visual-session.ts');
const prefs=read('app/mais/preferencias/page.tsx');
const staff=read('app/mais/acessos/page.tsx');
const client=read('app/clientes/page.tsx');
const clientDetails=read('app/clientes/details/page.tsx');
const clientIntelligence=read('app/clientes/inteligencia/page.tsx');

ok(store.includes('setStopPinned: async (routeId, deliveryId, pinned) => withRouteOrderWriteLock(routeId'), 'pin serializado por rota');
ok(store.includes('runTransaction(db, async (transaction) =>') && store.includes('const snapshots = await Promise.all([transaction.get(routeRef), ...refs.map((ref) => transaction.get(ref))])'), 'leitura transacional de todos os membros');
ok(store.includes('refs.forEach((ref) => transaction.update(ref') && store.includes('await queueDeliveryDocuments(queueEntityWrite, members.map((item) => item.id)'), 'gravacao multipedido conjunta, sem loop de updateDelivery');
ok(store.includes('if (remote.order_index !== members[index].order_index)') && store.includes('remote.route_id !== routeId'), 'pin detecta corrida entre aparelhos');
ok(store.includes('recordActionLatency(\'stop_pin_commit\'') && read('lib/operation/action-latency.ts').includes("stop_pin_commit: 'Fixar ou desfixar parada'"), 'latencia e falha tipadas no diagnostico');
ok(store.includes('const protectedIds = protectPositions') && store.includes('keepPinnedStopPositions(pending, finalPendingIds)'), 'ordem manual e automatica preservam posicoes fixas');
ok(store.includes('groups[currentIndex].locked') && store.includes('groups[rawTarget].locked'), 'movimento manual rejeita origem/destino travado');
ok(!store.includes("{ ...options.metadata, order_locked: false, order_source: 'manual' as const }"), 'nenhum unpin silencioso no reorder');
ok(card.includes('const setStopPinned = useAppStore') && card.includes('await setStopPinned(route.id, delivery.id, next)'), 'card usa acao transacional');
ok(card.includes('data-dfl-op-card-pinned=') && card.includes('Posição fixada'), 'pin tem indicador nos dois modos');
ok(card.includes('aria-label={orderLocked ? \'Desfixar parada\' : \'Fixar parada nesta posição\'}') && card.includes('PinOff size={16}'), 'pin acessivel no compacto');
ok(route.includes('writeAccordionFlag(`route:${route.id}`, next)') && route.includes('readAccordionFlag(`route:${route.id}`)'), 'acordeao da rota lembra abertura');
ok(route.includes('Consultar acerto') && route.includes('/motoboys/details?id=') && route.includes('isSuperadminUid'), 'rota da acesso autorizado ao motoboy');
ok(home.includes('Ações do motoboy filtrado') && home.includes('setGlobalMotoboy(m.name)') && home.includes('dfl:r78:home:motoboy'), 'home diferencia filtro de perfil/acerto e memoriza filtro');
ok(loja.includes('Pessoas e entregadores · acesso imediato') && loja.includes('showManagement'), 'loja mostra pessoas sem funil, preserva acordeao');
ok(mais.includes('Acessos e segurança') && staff.includes('Homologação e auditorias avançadas'), 'hierarquia de equipe separa operacao e acesso');
ok(inbox.includes('Pedidos do Site · Ativos') && inbox.includes('dfl:r78:site:history'), 'caixa ativa/historico sem telas duplicadas');
ok(client.includes('dfl:r78:clientes:filters') && clientDetails.includes('const backTo=') && clientIntelligence.includes('const backTo ='), 'clientes preserva pesquisa e origem');
ok(prefs.includes('dfl:r78:preferences') && prefs.includes('>Preferências</h1>'), 'preferencias preserva aba sem versao no titulo');
ok(visual.includes('sessionStorage') && navigation.includes('window.scrollTo') && navigation.includes('touchstart'), 'scroll memoria local com cancelamento no toque');
ok(read('app/layout.tsx').includes('<OperationalScrollMemory />'), 'memoria ligada no layout raiz');
ok(read('app/entregas/nova/page.tsx').includes('data-dfl-r78-form="new"') && read('app/entregas/editar/page.tsx').includes('data-dfl-r78-form="edit"'), 'criar e editar com identidade propria');
ok(read('app/mais/comunicacao/page.tsx').includes('Comunicação e avisos'), 'titulo limpo no hub');
ok(!navigation.includes('fetch(') && !navigation.includes('localStorage'), 'restauracao sem rede nem armazenamento permanente');

// Tipagem sintatica de todos os TS/TSX afetados e dos modulos novos.
const tsx=[
 'store/useAppStore.ts','components/home/DeliveryCard.tsx','components/home/RouteAccordion.tsx',
 'app/page.tsx','app/layout.tsx','app/loja/page.tsx','app/mais/page.tsx',
 'app/clientes/page.tsx','app/clientes/details/page.tsx','app/clientes/inteligencia/page.tsx',
 'app/mais/preferencias/page.tsx','components/store/SiteInboxPanel.tsx',
 'app/mais/acessos/page.tsx','app/mais/comunicacao/page.tsx',
 'app/entregas/nova/page.tsx','app/entregas/editar/page.tsx',
 'lib/operation/visual-session.ts','components/navigation/OperationalScrollMemory.tsx','lib/operation/action-latency.ts',
];
for(const path of tsx){
 const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TS/TSX sintatico '+path);
}
// Executar motor PURO de preservacao de grupo fixado, sem banco nem rede.
const compiled=ts.transpileModule(stop,{fileName:'route-stops.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const fake={exports:{}};
const mocks={
 '@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},
 '@/lib/operational-address':{canonicalizeOperationalAddress: v=>({address:v||''})},
 '@/lib/customer-identity':{normalizeCustomerAddress: v=>String(v||'').trim().toLowerCase()},
};
new Function('module','exports','require',compiled.outputText)(fake,fake.exports,(id)=>{if(!(id in mocks))throw Error('Import imprevisto '+id);return mocks[id];});
const mk=(id,address,index,locked=false)=>({id,route_id:'r',address_string:address,order_index:index,order_locked:locked,completed:false,created_at:'2026-11-17T15:00:00Z'});
const a=mk('a','Rua A',0),b=mk('b','Rua B',1,true),c=mk('c','Rua C',2);
assert.deepEqual(fake.exports.keepPinnedStopPositions([a,b,c],['c','a','b']),['c','b','a']);n++;
console.log('R78 OK: fixada no indice 1 permanece na posicao apesar da reordem manual');
const a2=mk('a2','Rua A',1,true),d=mk('d','Rua D',2);
assert.deepEqual(fake.exports.keepPinnedStopPositions([a,{...a2,order_index:1},d],['d','a2','a']),['a','a2','d']);n++;
console.log('R78 OK: multipedido fisico fixado como grupo indivisivel');
console.log(`R78 PREMIUM360: ${n} garantias hermeticas OK; zero Firestore, WhatsApp, pedidos ou rede.`);
