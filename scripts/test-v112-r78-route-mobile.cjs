#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');let count=0;
const ok=(v,m)=>{assert.ok(v,'R78: '+m);count++;console.log('✓ '+m)};
for(const file of ['components/home/DeliveryCard.tsx','app/loja/page.tsx','lib/delivery-presentation.ts']){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TypeScript/JSX '+file);
}
const card=read('components/home/DeliveryCard.tsx'),store=read('app/loja/page.tsx');
ok(card.includes('moveDeliveryToIndex(route.id, delivery.id, boundedTarget)'),'reordenacao usa store existente por parada');
ok(card.includes("route.status === 'aberta' && !delivery.completed")&&card.includes('pendingCount > 1'),'nao move rota fechada ou parada concluida');
ok(card.includes('role="group" aria-label="Subir ou descer parada" className="flex')&&!card.includes('rounded-xl border border-zinc-800 bg-zinc-950 sm:flex'),'setas voltaram ao Android');
ok(card.includes('Mover uma posição para cima')&&card.includes('Mover uma posição para baixo')&&card.includes('disabled={reorderBusy || orderLocked ||'),'setas acessiveis, bloqueio por trava e estado');
ok(card.includes('setMoveSheetOpen(true)')&&card.includes('toggleStopLock')&&card.includes('moveSheetOpen'),'move sheet e fixar permanecem');
ok(!card.includes('toggleDeliveryExpansion(item.id, false)')&&!card.includes('if (delivery.is_expanded) toggleDeliveryExpansion(delivery.id, false)'), 'abrir um cartão não fecha os demais nem reinicializa ao montar');
ok(card.includes('toggleDeliveryExpansion(delivery.id, !isExpanded)'),'minimizar continua explícito');
ok(card.includes('aria-label="Minimizar esta parada"')&&card.includes('if (isExpanded || isSwiping'), 'expansao permanece até minimizar por ação dedicada');
ok(card.includes('channelStyle.rail')&&card.includes('channelStyle.badge')&&card.includes('<ChannelIcon size={19}'),'faixa lateral, badge legivel e icon Lucide');
for(const label of ["label: 'IFOOD'","label: '99FOOD'","label: 'SITE'","label: 'LOJA'","label: 'MISTO'"])ok(card.includes(label),'origem distinta '+label);
ok(!card.includes("label: 'WHATSAPP'"),'origem WhatsApp não substitui Loja');
ok(card.includes('mixedOrigins')&&card.includes('deliveryChannel(item) !== visualOrigin'),'paradas multi-origem nao apresentam bandeira falsa');
const compras=store.indexOf("router.push('/abastecimentos')"),estoque=store.indexOf("router.push('/estoque')"),gestao=store.indexOf('aria-expanded={showManagement} onClick={toggleManagement}');
ok(compras>0&&estoque>compras&&estoque<gestao,'Compras e Estoque sempre visiveis antes da Gestão recolhivel');
ok(store.includes("router.push('/clientes')")&&store.includes("router.push('/equipe')")&&store.includes('showManagement && (<>'),'Gestão e clientes existentes mantidos');
// Check real source authority (not hardcoded visual guesses).
const presentation=read('lib/delivery-presentation.ts');
const js=ts.transpileModule(presentation,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};
vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{}, {filename:'lib/delivery-presentation.ts'})(id=>{if(id==='@/lib/operational-address')return {canonicalizeOperationalAddress:v=>({address:v||''})};throw Error('dep unexpected '+id)},mod,mod.exports);
const channel=mod.exports.deliveryChannel;
ok(channel({origin:'ifood'})==='ifood','origem iFood vermelha');
ok(channel({origin:'food99'})==='food99','origem 99Food amarela');
ok(channel({origin:'loja'})==='store','WhatsApp/Instagram/presencial continuam Loja verde');
ok(channel({origin:'ifood',source_system:'dfl_site'})==='site','pedido do Site prevalece azul');
ok(read('scripts/pre-apk.cjs').includes('scripts/test-v112-r78-route-mobile.cjs'),'R78 integrada no PRE-APK');
console.log(`R78: ${count} verificacoes reais/estruturais aprovadas`);
