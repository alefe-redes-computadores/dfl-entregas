#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=file=>fs.readFileSync(file,'utf8');let tests=0;
const ok=(value,label)=>{assert.ok(value,'R80 '+label);tests++;console.log('✓ '+label)};
for(const file of ['lib/navigation-links.ts','lib/location-evidence.ts','components/deliveries/MiniMap.tsx','components/deliveries/LocationEvidencePreview.tsx','components/home/DeliveryCard.tsx','components/home/RouteAccordion.tsx','components/layout/BottomNav.tsx','components/reports/SummaryCard.tsx','app/mais/page.tsx']){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'sintaxe '+file);
}
const card=read('components/home/DeliveryCard.tsx');const route=read('components/home/RouteAccordion.tsx');
const store=read('store/useAppStore.ts');const preview=read('components/deliveries/LocationEvidencePreview.tsx');
ok(card.includes('void moveStop(0)')&&card.includes('void moveStop(pendingCount-1)'),'acoes ir primeiro e deixar por ultimo usam motor real');
ok(card.includes('disabled={reorderBusy || orderLocked || (position || 1) <= 1}')&&card.includes('disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount}'),'posicoes e fixacao bloqueiam movimentacao ilegal');
ok(card.includes('Mover parada expandida')&&card.includes('role="group" aria-label="Subir ou descer parada"')&&!card.includes('onPointerMove={handleReorderPointerMove}'),'setas presentes e alça de arraste removida');
ok(card.includes('max-w-[54%]')&&card.includes('[overflow-wrap:anywhere]')&&card.includes('min-w-0 flex-1 flex-col'),'cabecalho pode expandir verticalmente sem cortar nome nem valor');
ok(route.includes('role="status" aria-live="polite"')&&route.includes('Aguardando confirmação do fechamento')&&route.includes('autoCloseCompletedRoutes !== false'),'fechamento comunica estado sem simular ACK remoto');
ok(store.includes('keepPinnedStopPositions(pending, finalPendingIds)')&&store.includes('moveStopToIndex(pending, deliveryId, rawTarget)')&&store.includes('canAutoCloseRoute(route, routeDeliveries)'),'motor transacional agrupado e fechamento preservados');
ok(read('components/layout/BottomNav.tsx').includes('useMemo(() => siteInboxProjection(deliveries).total, [deliveries])'),'badge da caixa evita reprocessamento em render isolado');
ok(read('components/reports/SummaryCard.tsx').includes('[overflow-wrap:anywhere]')&&!read('components/reports/SummaryCard.tsx').includes('whitespace-nowrap font-black'),'valores grandes nao forcam overflow');
ok(read('app/mais/page.tsx').includes('break-all text-sm'),'dados de perfil nao estouram na tela estreita');
ok(preview.includes('buildNavigationLinks(address,mapsLink)')&&preview.includes('Navegar · Waze')&&preview.includes('Navegar · Maps')&&preview.includes('{open&&<div'),'atalhos para navegacao sob demanda, sem carregar mapas em massa');
ok(card.includes('Navegar com Maps')&&card.includes('Navegar com Waze')&&card.includes('navigationLinks &&'),'card expandido tambem oferece navegacao Maps/Waze');
ok(read('components/deliveries/MiniMap.tsx').includes("evidence.kind === 'coordinate' ? mapsLink : undefined"),'iframe nao confia em coordenada de link nao reconhecido');
ok(!/onSnapshot\(|getDocs\(|runTransaction\(/.test([card,route,preview].join('\n')),'UI nao acrescenta listeners ou leituras Firestore');
// Real pure-model executions without network, Firebase, or shell mocks of results.
function load(file,mocks={}){const output=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};vm.runInNewContext(`(function(require,module,exports){${output}\n})`,{}, {filename:file})(name=>{if(!(name in mocks))throw Error('Unexpected import '+name);return mocks[name]},mod,mod.exports);return mod.exports;}
const maps=load('lib/maps.ts');const evidence=load('lib/location-evidence.ts',{'@/lib/maps':maps});const nav=load('lib/navigation-links.ts',{'@/lib/maps':maps,'@/lib/location-evidence':evidence});
const good='https://www.google.com/maps?q=-18.589,-46.518';
const precise=evidence.locationEvidence('Rua Principal, 100',good);
ok(precise.kind==='coordinate'&&precise.mapsUrl===good,'Google Maps com coordenadas gera evidencia, sem percentual inventado');
ok(evidence.locationEvidence('Rua X, 1','https://evil.example/@-18.589,-46.518').kind==='numbered','URL externa nao simula pin com coordenadas');
ok(evidence.locationEvidence('Rua X, 1','javascript:alert(1)').mapsUrl.startsWith('https://www.google.com/maps/search'),'esquemas inseguros descartados');
ok(evidence.locationEvidence('Rua X, 1','https://maps.app.goo.gl/abc').kind==='link','link curto do Google Maps preservado como nao verificavel');
ok(nav.buildNavigationLinks('',undefined)===null,'navegacao vazia nao abre destino ficticio');
const coordinateLinks=nav.buildNavigationLinks('Rua Principal, 100',good);
ok(coordinateLinks.hasCoordinates&&coordinateLinks.waze.includes('ll=-18.589%2C-46.518')&&coordinateLinks.waze.endsWith('navigate=yes'),'Waze com coordenadas e navegacao ativa');
ok(coordinateLinks.maps.includes('destination=-18.589%2C-46.518')&&coordinateLinks.maps.includes('api=1'),'Google Maps com destino coordenado');
const textLinks=nav.buildNavigationLinks('Rua das Flores, 123 - Centro','https://evil.example/@-18,-46');
ok(textLinks.hasCoordinates===false&&textLinks.waze.includes('q=Rua%20das%20Flores')&&textLinks.maps.includes('Patos%20de%20Minas'),'link externo ignorado; busca pelo endereco textual');
const stops=load('lib/route-stops.ts',{'@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},'@/lib/operational-address':{canonicalizeOperationalAddress:s=>({address:s})},'@/lib/customer-identity':{normalizeCustomerAddress:s=>String(s||'').toLowerCase().trim()}});
const a={id:'a',route_id:'R',address_string:'A, 1',completed:false,order_index:0},b={id:'b',route_id:'R',address_string:'B, 2',completed:false,order_index:1},c={id:'c',route_id:'R',address_string:'B, 2',completed:false,order_index:2,source_system:'dfl_site'},d={id:'d',route_id:'R',address_string:'D, 4',completed:false,order_index:3};
ok(Array.from(stops.moveStopToIndex([a,b,c,d],'b',0)).join(',')==='b,c,a,d','Ir primeiro move dois pedidos do mesmo endereco com Site');
ok(Array.from(stops.moveStopToIndex([a,b,c,d],'a',2)).join(',')==='b,c,d,a','Deixar por ultimo move uma parada inteira');
ok(Array.from(stops.keepPinnedStopPositions([a,{...b,order_locked:true},c,d],['d','a','b','c'])).join(',')==='d,b,c,a','posicao fixada permanece apos reordem');
ok(stops.groupDeliveriesByStop([{...a,completed:true},b,c,d]).at(-1).representative.id==='a','concluida fica no fim');
ok(read('scripts/pre-apk.cjs').includes('scripts/test-v112-r80-global-release.cjs'),'R80 incluida no PRE-APK global');
console.log('R80 RELEASE: '+tests+' contratos estruturais e testes comportamentais aprovados');
