#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');let n=0;
const ok=(value,label)=>{assert.ok(value,'R81 '+label);n++;console.log('✓ '+label)};
for(const file of ['components/home/DeliveryCard.tsx','components/home/RouteAccordion.tsx','app/estoque/page.tsx','types/index.ts','lib/delivery-attempts.ts','scripts/verify-v105-drag-stock-performance.cjs','scripts/verify-v106-drag-route-consistency.cjs']){
 const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
 ok(ast.parseDiagnostics.length===0,'sintaxe '+file);
}
const card=read('components/home/DeliveryCard.tsx'),route=read('components/home/RouteAccordion.tsx'),stock=read('app/estoque/page.tsx'),store=read('store/useAppStore.ts');
ok(!card.includes('handleReorderPointerDown')&&!card.includes('GripVertical')&&!card.includes('setPointerCapture(event.pointerId)'),'arraste e alça removidos por completo');
ok(card.includes('role="group" aria-label="Subir ou descer parada" className="flex')&&card.includes('Mover para…')&&card.includes('Fixar'),'setas visíveis com seletor e trava');
ok(card.includes('disabled={reorderBusy || orderLocked || (position || 1) <= 1}')&&card.includes('disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount}'),'limites, trava e clique duplo protegidos');
ok(route.includes('stopGroup.pending[0] || stopGroup.representative')&&route.includes('stopDeliveries={stopGroup.deliveries}'),'parada ainda pendente representada corretamente após baixar um pedido agrupado');
ok(store.includes('moveStopToIndex(pending, deliveryId, rawTarget)')&&store.includes('keepPinnedStopPositions(pending, finalPendingIds)'),'autoridade transacional preservada');
ok(card.includes("style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}")&&card.includes('Origem ${channelStyle.label}')&&!card.includes('<ChannelIcon size={11} aria-hidden="true" />{channelStyle.label}'),'identidade lateral vertical sem selo debaixo do nome');
ok(stock.includes('data-stock-product={product.id} role="group" tabIndex={0}')&&stock.includes('onClick={(event)=>{if((event.target as HTMLElement).closest')&&stock.includes("event.stopPropagation();open()"),'card abre movimentação; nome abre detalhes com propagação isolada');
ok(card.includes('Registrar tentativa (sem dar baixa)')&&card.includes('delivery_attempts: appendDeliveryAttempt')&&card.includes('A entrega permanece pendente'),'tentativa registrada como histórico, sem conclusão');
ok(card.includes('pendingGroupedDeliveries.map(item => <option')&&card.includes('attemptTargetId'),'parada agrupada permite escolher pedido individual');
ok(card.includes('attemptMoveLast')&&card.includes('void saveAttempt()'),'tentativa pode sugerir mover parada por motor existente');
ok(!/onSnapshot\(|getDocs\(|runTransaction\(/.test([card,route,stock].join('\n')),'UI sem consultas remotas novas');
function load(file,deps={}){const src=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};vm.runInNewContext(`(function(require,module,exports){${src}
})`,{}, {filename:file})(key=>{if(!(key in deps))throw Error('import inesperado '+key);return deps[key]},mod,mod.exports);return mod.exports}
const attempts=load('lib/delivery-attempts.ts');
const a={id:'a',reason:'customer_absent',at:'2026-10-23T10:00:00.000Z',note:' Sem resposta '};
const b={id:'b',reason:'later_requested',at:'2026-10-23T11:00:00.000Z'};
const one=attempts.appendDeliveryAttempt(undefined,a),two=attempts.appendDeliveryAttempt(one,b);
ok(one.length===1&&one[0].note==='Sem resposta'&&two.length===2&&one.length===1,'tentativas imutáveis e observação normalizada');
ok(attempts.appendDeliveryAttempt(two,b).length===2,'idempotência por ID da tentativa');
ok(attempts.deliveryAttemptLabel('later_requested')==='Pediu para entregar mais tarde','motivo da tentativa definido');
const stops=load('lib/route-stops.ts',{'@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},'@/lib/operational-address':{canonicalizeOperationalAddress:x=>({address:x})},'@/lib/customer-identity':{normalizeCustomerAddress:x=>String(x||'').toLowerCase().trim()}});
const d=[{id:'i',route_id:'r',address_string:'A, 1',order_index:0,completed:false},{id:'g',route_id:'r',address_string:'B, 2',order_index:1,completed:false},{id:'site',route_id:'r',address_string:'B, 2',order_index:2,source_system:'dfl_site',completed:false},{id:'last',route_id:'r',address_string:'C, 3',order_index:3,completed:false}];
ok(Array.from(stops.moveStopToIndex(d,'site',0)).join(',')==='g,site,i,last','pedido do Site reordena o grupo sem separá-lo');
ok(Array.from(stops.moveStopToIndex(d,'g',2)).join(',')==='i,last,g,site','grupo vai para última parada');
ok(Array.from(stops.keepPinnedStopPositions([...d.slice(0,1),{...d[1],order_locked:true},...d.slice(2)],['last','i','site','g'])).join(',')==='last,g,site,i','grupo fixado respeita posição anterior');
ok(stops.groupDeliveriesByStop([{...d[1],completed:true},d[2],d[0]]).some(x=>x.pending.length>0 && x.pending[0]?.id==='site'),'parada mista concluída/pendente mantém pedido site ativo');
ok(read('scripts/test-v112-r74-macro.cjs').includes('alça removida; setas e travas presentes no mobile'),'R74 valida nova UX');
ok(read('scripts/verify-v111-r12-route-macro.cjs').includes('setas e trava substituem captura por arraste'),'R12 valida setas');
ok(read('scripts/pre-apk.cjs').includes("scripts/test-v112-r81-interaction-attempt.cjs"),'R81 integrada ao PRE-APK');
console.log(`R81: ${n} contratos operacionais e cenários executáveis aprovados`);
