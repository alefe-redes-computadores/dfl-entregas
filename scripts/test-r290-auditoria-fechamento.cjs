#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let n=0;function ok(x,msg){assert.ok(x,'R290: '+msg);n++;console.log('OK R290:',msg)}
const required=[
 'lib/operation/siteInboxPolicy.ts','components/store/SiteInboxPanel.tsx',
 'components/store/OperationalAttentionQueue.tsx','components/messaging/MessagingOrderPicker.tsx',
 'components/home/DeliveryCard.tsx','scripts/pre-apk.cjs'
];
for(const file of required.filter(x=>/\.tsx?$/.test(x))){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'AST '+file);
}
const policy=read('lib/operation/siteInboxPolicy.ts');
ok(policy.includes('queueStatePriority') && policy.includes('a.delivery.created_at || a.delivery.createdAt || a.delivery.site_order_last_event_at'), 'cronologia por cadastro, sem reposicionar ao atualizar evento');
const ui=read('components/store/SiteInboxPanel.tsx');
ok(ui.includes('delivery.is_urgent === true')&&ui.includes('sujeito à aprovação comercial')&&ui.includes('allocate(delivery.id'), 'fila urgente nunca equivale a aprovado');
const attention=read('components/store/OperationalAttentionQueue.tsx');
ok(attention.includes('kindPriority[a.kind]-kindPriority[b.kind]')&&attention.includes('urgentDeliveryIds.has(task.deliveryId)')&&attention.includes('aTime-bTime'), 'pendencias por categoria, urgencia e idade');
const messaging=read('components/messaging/MessagingOrderPicker.tsx');
ok(messaging.includes('(norm ? deliveries : recent)')&&messaging.includes('topRanked(deliveries, 120')&&messaging.includes('15, compare)'), 'busca total sem montar lista enorme');
ok(messaging.includes('manual_messaging_opt_in_v1')&&messaging.includes('maskedMessagePhone')&&messaging.includes('deliveries.find(item => item.id === selectedId)'), 'mensageria manual indicada sem expor telefone nem perder seleção');
for(const unsafe of ['fetch(', 'getDocs(', 'onSnapshot(', 'setDoc(', 'sendWhatsApp', 'runTransaction('])ok(!messaging.includes(unsafe),'seletor puro sem operacao: '+unsafe);
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes('completionBusyRef.current = true;\n        setCompletionBusy(true);\n        const reopenToastId') && card.includes('await updateDelivery(delivery.id, { completed: false });') && card.includes('window.clearTimeout(reopenNotice);') && card.includes('completionBusyRef.current = false;'), 'reabrir bloqueia duplo toque e confirma remotamente');
ok(card.includes('for (const item of targets)')&&card.includes('await updateDelivery(item.id, updatePayload)'), 'baixa em grupo continua sequencial e segura');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r290-auditoria-fechamento.cjs'")&&pre.includes("'scripts/test-r289-final-visual.cjs'")&&pre.includes("'scripts/test-r288-mensagens-imagens.cjs'"),'R288-R290 sem excluir suites');
// Exercitar sem Firestore e sem sistema externo
const compiled=ts.transpileModule(policy,{fileName:'siteInboxPolicy.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleObj={exports:{}};
const mock={
 '@/lib/delivery-mode':{getFulfillmentMode:d=>d.fulfillment_mode||'delivery'},
 '@/lib/integration/site-order':{isCancelledSiteDelivery:d=>d.site_order_status==='cancelado',normalizeSiteOrderStatus:x=>String(x||'').toLowerCase()},
 '@/lib/scheduled-delivery':{isFutureScheduledDelivery:(d,now)=>Boolean(d.scheduled_for)&&Date.parse(d.scheduled_for)>now},
 '@/lib/operational-time':{dateKey:()=> '2026-11-06',routeOperationalDateKey:()=> '2026-11-06'},
};
new Function('require','module','exports',compiled)(id=>{if(!mock[id])throw Error('mock faltando '+id);return mock[id];},moduleObj,moduleObj.exports);
const {siteInboxProjection,siteInboxState}=moduleObj.exports;
const now=Date.parse('2026-11-06T17:00:00-03:00');
const base={source_system:'dfl_site',origin:'loja',fulfillment_mode:'delivery',completed:false,route_id:'',address_string:'Rua X 5',site_order_status:'confirmado'};
const one=(id,extra)=>({...base,id,external_order_id:id,...extra});
const readyOld=one('ready-old',{created_at:'2026-11-06T10:00:00Z',site_order_last_event_at:'2026-11-06T19:00:00Z'});
const readyNew=one('ready-new',{created_at:'2026-11-06T12:00:00Z',site_order_last_event_at:'2026-11-06T13:00:00Z'});
const urgent=one('urgent',{created_at:'2026-11-06T16:00:00Z',is_urgent:true});
const commercial=one('commercial',{created_at:'2026-11-06T09:00:00Z',site_order_status:'pendente',is_urgent:true});
const scheduled=one('scheduled',{created_at:'2026-11-06T08:00:00Z',scheduled_for:'2026-11-07T20:00:00Z'});
const duplicate=one('duplicated',{external_order_id:'duplicated',created_at:'2026-11-06T05:00:00Z'});
const collision={...duplicate,id:'duplicated-copy'};
const all=siteInboxProjection([readyNew,commercial,scheduled,duplicate,urgent,readyOld,collision],now);
ok(all.total===6 && all.duplicates===1 && all.review===1,'colisao bloqueante, contagem sem duplicar');
ok(all.rows[0].duplicate===true && all.rows[0].state==='revisar','colisao em destaque sem liberar alocacao');
ok(all.rows[1].delivery.id==='urgent','urgente pronto antes de outros prontos');
ok(all.rows[2].delivery.id==='ready-old'&&all.rows[3].delivery.id==='ready-new','FIFO pela criacao, nao pelo ultimo evento');
ok(all.rows[4].delivery.id==='commercial'&&all.rows[4].state==='confirmar','urgente sem aprovacao nao fura prontidao');
ok(all.rows[5].delivery.id==='scheduled'&&all.rows[5].state==='aguardar_agenda','agendamento nao vira pedido pronto');
console.log(`R290 AUDITORIA FECHAMENTO: ${n} verificacoes locais, sem Firestore/WhatsApp.`);
