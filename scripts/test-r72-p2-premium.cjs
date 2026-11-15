#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let count=0;
const check=(v,label)=>{assert.ok(v,'R72 P2: '+label);count++};
const eq=(a,b,label)=>{assert.deepEqual(a,b,'R72 P2: '+label);count++};
const newFiles=[
  'lib/operation/premium-temporal.ts','lib/integration/manualFirstStopPolicy.ts',
  'components/ui/PremiumTemporalFields.tsx','components/messaging/MessagingJourneyPanel.tsx',
  'components/deliveries/DeliveryFormPremiumGuide.tsx',
];
const touched=[
  'app/mais/mensageria/page.tsx','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx',
  'app/despesas/novo/page.tsx','app/despesas/editar/page.tsx','components/fuelings/FuelingForm.tsx',
  'app/loja/page.tsx','app/mais/notificacoes/page.tsx','components/customers/CustomerReviewPanel.tsx',
  'components/store/SiteFutureRoutePlanner.tsx','app/estoque/contagem/page.tsx',
  'lib/integration/server/manualMessaging.ts','scripts/pre-apk.cjs',
];
for(const path of [...newFiles,...touched].filter(p=>/\.(ts|tsx)$/.test(p))){
  check(fs.existsSync(path),'arquivo existe '+path);
  const syntax=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  eq(syntax.parseDiagnostics.map(d=>String(d.messageText)),[],'TS AST '+path);
}
function load(file,deps={}){
  const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{}, {filename:file})(name=>{
    if(!(name in deps)) throw Error('dependencia inesperada '+name);
    return deps[name];
  },m,m.exports);
  return m.exports;
}
const t=load('lib/operation/premium-temporal.ts');
eq(t.maskBrDate('15.11.2026'),'15/11/2026','mascara BR pontuada');
eq(t.maskBrDate('1511202633'),'15/11/2026','limite de 8 digitos');
eq(t.maskBrClock('2345'),'23:45','mascara hora');
eq(t.maskBrClock('123'),'12:3','hora parcial');
eq(t.brDateToIso('15/11/2026'),'2026-11-15','BR para ISO');
eq(t.isoDateToBr('2026-11-15'),'15/11/2026','ISO para BR');
eq(t.brDateToIso('29/02/2024'),'2024-02-29','bissexto');
eq(t.brDateToIso('29/02/2025'),null,'nao bissexto');
eq(t.brDateToIso('31/04/2026'),null,'abril nao tem 31');
eq(t.brDateToIso('00/11/2026'),null,'dia zero');
eq(t.brDateToIso('15/13/2026'),null,'mes 13');
eq(t.brDateToIso('15/11/1999'),null,'ano fora de janela');
eq(t.brClockToHHMM('23:59'),'23:59','horario limite');
eq(t.brClockToHHMM('24:00'),null,'hora invalida');
eq(t.brClockToHHMM('12:60'),null,'minuto invalido');
eq(t.brDateTimeToLocal('15/11/2026','14:31'),'2026-11-15T14:31','datetime sem deslocamento de fuso');
eq(t.brDateTimeToLocal('30/02/2026','14:31'),null,'datetime data impossivel');
eq({...t.splitLocalDateTime('2026-11-15T14:31')},{date:'15/11/2026',time:'14:31'},'split preserva hora local');
eq({...t.splitLocalDateTime('2026-02-30T14:31')},{date:'',time:''},'split rejeita dia impossivel');
const rules=load('lib/integration/manualFirstStopPolicy.ts',{'@/lib/route-stops':{deliveryStopKey:d=>d.stop_group_id||d.address_string||d.id}});
const route={id:'rota-a',status:'aberta',started_at:'2026-11-15T15:00:00Z'};
const first={id:'a',route_id:'rota-a',order_index:0,stop_group_id:'fisica-1',completed:false,fulfillment_mode:'delivery'};
const paired={...first,id:'b',order_index:1};
const second={...first,id:'c',order_index:2,stop_group_id:'fisica-2'};
const planned=rules.manualFirstStopContext(route,[second,paired,first]);
eq(planned.size,2,'duas comandas na mesma parada fisica');
eq(planned.get('a').planned_stop,1,'numero da primeira parada');
eq(planned.get('b').total_stops,2,'total de paradas fisicas');
check(!planned.has('c'),'segunda parada nao recebe contexto primeiro');
eq(rules.manualFirstStopContext({...route,status:'fechada'},[first,second]).size,0,'rota fechada fail closed');
eq(rules.manualFirstStopContext(route,[{...first,completed:true},second]).size,0,'primeira parada ja concluida nao vira primeiro aviso');
eq(rules.manualFirstStopContext(route,[{...first,order_index:undefined},second]).size,0,'ordem incerta nao inventa primeira parada');
eq(rules.manualFirstStopContext(route,[{...first,fulfillment_mode:'pickup'},second]).size,1,'retirada nao ocupa parada fisica');
eq(rules.manualFirstStopContext(route,[{...first,return_to_store:{route_id:'rota-a',attempt_id:'1'}},second]).size,1,'retorno nao ocupa parada ativa');
const srv=read('lib/integration/server/manualMessaging.ts');
for (const token of ["manualFirstStopContext(","reason === 'route_started'","firstStopByDelivery.get(d.id)","...(firstStop||{})", "r8Authorized(plan.phone)","planManualMessage({", "manual_messaging_opt_in_v1:true", "manual-msg-v1__${plan.eventType}__${delivery.id}"])check(srv.includes(token),'contrato servidor '+token);
check(!srv.includes('event_type:\'delivery.first_stop\''),'sem evento adicional que dispara duplicado');
check(!/<select\b/i.test(read('app/entregas/retornos/page.tsx')),'retornos sem seletor nativo');
check(read('app/entregas/retornos/page.tsx').includes('PremiumChoicePicker'),'retornos usa seletor premium controlado');
for(const p of ['components/customers/CustomerReviewPanel.tsx','components/store/SiteFutureRoutePlanner.tsx','app/estoque/contagem/page.tsx']){
  check(!/<select\b/i.test(read(p)),'sem seletor nativo '+p);
  check(read(p).includes('PremiumChoicePicker'),'controle premium '+p);
}
for(const p of ['app/despesas/novo/page.tsx','app/despesas/editar/page.tsx','components/fuelings/FuelingForm.tsx','app/loja/page.tsx','app/mais/notificacoes/page.tsx']){
  check(!/<input\b[^>]*type=["'](?:date|datetime-local|time)["']/i.test(read(p)),'sem calendario/horario nativo '+p);
  check(read(p).includes('PremiumDate')||read(p).includes('PremiumTime'),'editor temporal premium '+p);
}
check(read('app/mais/mensageria/page.tsx').includes('<MessagingJourneyPanel'),'central 360 visual');
check(read('components/messaging/MessagingJourneyPanel.tsx').includes('onTracking'),'link da central de acompanhamento');
check(read('components/messaging/MessagingJourneyPanel.tsx').includes('onReturns'),'link de retornos');
check(!/\b(fetch|onSnapshot|sendMessage|kickManualCreated)\s*\(/.test(read('components/messaging/MessagingJourneyPanel.tsx')),'central visual sem escrita/rede');
for(const p of ['app/entregas/nova/page.tsx','app/entregas/editar/page.tsx'])check(read(p).includes('<DeliveryFormPremiumGuide'),'guia premium '+p);
check(read('components/deliveries/DeliveryFormPremiumGuide.tsx').includes('não comprova recebimento'),'consentimento sem afirmar entrega');
check(read('scripts/pre-apk.cjs').includes('scripts/test-r72-p2-premium.cjs'),'gate PRE-APK registrado');
console.log(`R72_P2_PREMIUM_PASS: ${count} verificacoes; sem Firestore, WhatsApp, venda ou commit`);
