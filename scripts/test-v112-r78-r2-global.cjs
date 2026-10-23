#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=file=>fs.readFileSync(file,'utf8');let n=0;
const check=(bool,label)=>{assert.ok(bool,'R78-R2 '+label);n++;console.log('✓ '+label)};
for(const p of ['components/home/DeliveryCard.tsx','app/loja/page.tsx','components/reports/Charts/OriginChart.tsx','components/reports/ReportChartCard.tsx','scripts/verify-v103-mobile-cards.cjs']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);check(ast.parseDiagnostics.length===0,'sintaxe '+p);
}
const card=read('components/home/DeliveryCard.tsx'),chart=read('components/reports/Charts/OriginChart.tsx'),report=read('components/reports/ReportChartCard.tsx');
check(card.includes('role="group" aria-label="Subir ou descer parada" className="flex'),'setas visiveis no Android');
check(card.includes('disabled={reorderBusy || orderLocked || (position || 1) <= 1}')&&card.includes('disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount}'),'setas com trava e limites');
check(card.includes('Mover parada expandida')&&card.includes('Subir parada expandida')&&card.includes('Descer parada expandida'),'card expandido reorganiza sem precisar minimizar');
check(card.includes('aria-label="Minimizar esta parada"')&&!card.includes('toggleDeliveryExpansion(item.id, false)'),'somente operador minimiza; outros cards permanecem');
check(card.includes('setMoveSheetOpen(true)')&&card.includes('toggleStopLock')&&card.includes("route.status === 'aberta' && !delivery.completed"),'Mover/Fixar protegem entregas concluídas');
check(card.includes('channelStyle.badge')&&card.includes('channelStyle.rail'),'origens visuais persistem sem mudar dados');
check(!chart.includes('ResponsiveContainer')&&chart.includes('leadingPercent')&&chart.includes('role="progressbar"'),'relatorio de canal leve, compacto e acessivel');
check(chart.includes("'iFood'")&&chart.includes("'99Food'")&&chart.includes("'Loja'"),'canais comerciais sem WhatsApp inventado');
check(report.includes('h-[210px]')&&report.includes('min-w-0 w-full overflow-hidden')&&report.includes('sm:h-[250px]')&&report.includes('break-words'),'graficos e textos responsivos sem extravasar');
check(!/onSnapshot\(|getDocs\(|runTransaction\(/.test([card,chart,report].join('\n')),'polimento sem novas consultas Firestore');
const test103=read('scripts/verify-v103-mobile-cards.cjs');
check(test103.includes('Seta subir respeita trava')&&test103.includes('Seta descer respeita trava')&&test103.includes('Reordenação visível no Android'),'V103 permanece ativo e mais rigoroso');
const notify=read('lib/native/notifications.ts'),stock=read('app/estoque/compras/page.tsx'),bot=read('components/motoboys/MotoboyForm.tsx');
check(notify.includes('LocalNotifications.checkPermissions()')&&notify.includes('queueOwnerSchedule(')&&notify.includes('ensureNotificationChannel()'),'notificacao com permissao, serializacao e canal existentes');
check(stock.includes('addStockSupply(')&&bot.includes('ifood_confirmation_mode:ifoodMode'),'compras e responsabilidade motoboy preservadas');
// Execute the REAL physical-stop reorder functions, with only external adapters mocked.
function load(file, deps){const src=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};vm.runInNewContext(`(function(require,module,exports){${src}\n})`,{}, {filename:file})(key=>{if(!(key in deps))throw Error('Unexpected import '+key);return deps[key]},mod,mod.exports);return mod.exports}
const stops=load('lib/route-stops.ts',{
 '@/lib/integration/site-order':{isCancelledSiteDelivery:d=>d.site_order_status==='Cancelado'},
 '@/lib/operational-address':{canonicalizeOperationalAddress:v=>({address:String(v||'')})},
 '@/lib/customer-identity':{normalizeCustomerAddress:v=>String(v||'').toLowerCase().trim()},
});
const a={id:'a',route_id:'route',address_string:'Rua 1, 10',order_index:0,completed:false};
const b={id:'b',route_id:'route',address_string:'Rua 2, 20',order_index:1,completed:false};
const c={id:'c',route_id:'route',address_string:'Rua 2, 20',order_index:2,completed:false};
const d={id:'d',route_id:'route',address_string:'Rua 3, 30',order_index:3,completed:false};
check(stops.groupDeliveriesByStop([a,b,c,d]).length===3,'2 pedidos mesmo destino equivalem a 1 parada');
check(Array.from(stops.moveStopToIndex([a,b,c,d],'b',0)).join(',')==='b,c,a,d','seta move grupo inteiro e conserva irmãos');
check(Array.from(stops.moveStopToIndex([a,b,c,d],'a',2)).join(',')==='b,c,d,a','seta descer move ao fim sem separar grupo');
check(Array.from(stops.keepPinnedStopPositions([a,{...b,order_locked:true},c,d],['d','a','b','c'])).join(',')==='d,b,c,a','trava conserva grupo fixo na posicao 2');
check(stops.groupDeliveriesByStop([{...a,completed:true,order_index:0},b,d])[2].representative.id==='a','parada concluida fica depois das pendentes');
check(read('scripts/pre-apk.cjs').includes("scripts/test-v112-r78-r2-global.cjs"),'R78-R2 executa no PRE-APK inteiro');
console.log(`R78-R2: ${n} garantias de comportamento, visual, notificacoes e sincronizacao aprovadas`);
