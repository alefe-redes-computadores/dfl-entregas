#!/usr/bin/env node
'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');let checks=0;
const ok=(v,n)=>{assert.ok(v,'R79 '+n);checks++;console.log('✓ '+n)};
for(const f of ['lib/location-evidence.ts','components/deliveries/LocationEvidencePreview.tsx','components/deliveries/MiniMap.tsx','components/home/DeliveryCard.tsx','components/home/OperationalRadar.tsx','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx','app/mais/notificacoes/page.tsx','app/loja/page.tsx','components/reports/ReportChartCard.tsx']){const ast=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'sintaxe '+f)}
const card=read('components/home/DeliveryCard.tsx'),preview=read('components/deliveries/LocationEvidencePreview.tsx'),radar=read('components/home/OperationalRadar.tsx'),map=read('components/deliveries/MiniMap.tsx'),store=read('store/useAppStore.ts');
ok(preview.includes('open&&')&&preview.includes('<MiniMap')&&preview.includes('aria-expanded={open}'),'mapa somente carregado sob demanda');
ok(card.includes('<LocationEvidencePreview address={delivery.address_string}')&&card.includes('locationEvidence(delivery.address_string'),'card compacto e expandido comunicam localizacao');
ok(map.indexOf('const targetLocation = useMemo')<map.indexOf('if (!address && !mapsLink) return null'),'hooks incondicionais ao preencher mapa');
ok(read('app/entregas/nova/page.tsx').includes('LocationEvidencePreview address={activeAddress}')&&read('app/entregas/editar/page.tsx').includes('LocationEvidencePreview address={streetAddress}'),'previa em criacao e edicao');
ok(radar.includes("insight.severity === 'warning' || insight.severity === 'attention'")&&radar.includes('Silenciar radar hoje'),'radar so chama atencao quando relevante');
ok(read('app/loja/page.tsx').includes("router.push('/mais/notificacoes')")&&read('app/mais/notificacoes/page.tsx').includes('O Android exige autorização explícita'),'configuracoes reais e permissao explicita');
ok(card.includes('role="group" aria-label="Subir ou descer parada"')&&!card.includes('onPointerMove={handleReorderPointerMove}')&&card.includes('keepPinned')===false,'setas e mover por posição permanecem, arraste removido');
ok(store.includes('keepPinnedStopPositions(pending, finalPendingIds)')&&store.includes('moveStopToIndex(pending, deliveryId, rawTarget)'),'motor de reordenacao central preservado');
ok(store.includes('autoCloseCompletedRoutes !== false')&&store.includes('canAutoCloseRoute(route, routeDeliveries)'),'fechamento seguro preservado');
ok(read('components/motoboys/MotoboyForm.tsx').includes('ifood_confirmation_mode:ifoodMode')&&card.includes("ifoodConfirmationMode !== 'motoboy'"),'confirmacao iFood continua por motoboy');
ok(read('app/loja/page.tsx').includes('marketplaceDeliveryModes')&&read('app/entregas/nova/page.tsx').includes('marketplaceModes?.food99'),'marketplaces seguem configuraveis');
ok(read('app/loja/page.tsx').includes('routeReminderEnabled:!routeReminderActive')&&read('app/loja/page.tsx').includes('autoCloseCompletedRoutes:!autoCloseActive'),'automacao e lembretes ajustaveis separadamente');
ok(!/onSnapshot\(|getDocs\(|runTransaction\(/.test([card,preview,radar].join('\n')),'nenhum listener Firestore novo');
function load(file,mocks={}){const code=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{}, {filename:file})(dep=>{if(!(dep in mocks))throw Error('Stub inesperado '+dep);return mocks[dep]},mod,mod.exports);return mod.exports;}
const maps=load('lib/maps.ts');const evidence=load('lib/location-evidence.ts',{'@/lib/maps':maps});
ok(evidence.locationEvidence('Rua Z, 123','https://www.google.com/maps?q=-18.590,-46.510').kind==='coordinate','link com coordenadas mas sem percentual inventado');
ok(evidence.locationEvidence('Rua Z, 123','').kind==='numbered','endereco numerado e busca, nao pin verificado');
ok(evidence.locationEvidence('Rua Z','').kind==='approximate','rua sem numero aproximada');
ok(evidence.locationEvidence('','').kind==='missing','endereco vazio nao embute mapa');
ok(evidence.locationEvidence('Rua Z, 12','https://maps.app.goo.gl/example').kind==='link','link curto nao alega coordenadas exatas');
const stops=load('lib/route-stops.ts',{'@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},'@/lib/operational-address':{canonicalizeOperationalAddress:s=>({address:s})},'@/lib/customer-identity':{normalizeCustomerAddress:s=>String(s||'').toLowerCase().trim()}});
const d=[{id:'a',route_id:'r',address_string:'Rua A, 1',order_index:0,completed:false},{id:'b',route_id:'r',address_string:'Rua B, 2',order_index:1,completed:false,order_locked:true},{id:'c',route_id:'r',address_string:'Rua B, 2',order_index:2,completed:false},{id:'site',route_id:'r',source_system:'dfl_site',address_string:'Rua C, 3',order_index:3,completed:false}];
ok(stops.groupDeliveriesByStop(d).length===3,'dois pedidos em 1 parada fisica');
ok(Array.from(stops.keepPinnedStopPositions(d,stops.moveStopToIndex(d,'site',0))).join(',')==='site,b,c,a','Site e parada agrupada movidos; grupo fixo protegido');
ok(stops.groupDeliveriesByStop([{...d[0],completed:true},...d.slice(1)])[2].representative.id==='a','concluidas vao para baixo');
ok(read('scripts/pre-apk.cjs').includes("scripts/test-v112-r79-operational.cjs"),'R79 no PRE-APK');
console.log('R79: '+checks+' garantias de testes aprovadas');
