const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = file => fs.readFileSync(file, 'utf8');
let passed = 0;
function ok(value, message) { assert.ok(value, message); passed++; }

const ui = read('components/store/SiteFutureRoutePlanner.tsx');
const inbox = read('components/store/SiteInboxPanel.tsx');
const store = read('store/useAppStore.ts');
const plan = read('lib/operation/future-route-planning.ts');
const ready = read('lib/operation/route-departure-readiness.ts');
const preapk = read('scripts/pre-apk.cjs');

for (const [name,source] of [['new planner',ui],['inbox',inbox],['store',store]]) {
  const parsed = ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,name==='store' ? ts.ScriptKind.TS:ts.ScriptKind.TSX);
  ok(parsed.parseDiagnostics.length === 0, `TSX/TS sem erros de parse em ${name}: ${parsed.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
}
ok(ui.includes('futureRoutePlan(deliveries, routes, now)'), 'planejamento le dados locais sem fetch/polling extra');
ok(ui.includes('reserve(deliveryId, routeId)'), 'reserva utiliza store transacional');
ok(ui.includes('plan.candidates.some(item => item.id === routeId)'), 'selecao valida candidatos');
ok(ui.includes('plan.issue ||'), 'revisao de identidade/endereco preservada');
ok(ui.includes('Sem despacho, aviso ao cliente ou mudança no preparo'), 'nunca afirma envio por reserva');
ok(inbox.includes('<SiteFutureRoutePlanner now={clock}/>'), 'planejamento exposto na Caixa do Site');
ok(inbox.includes("setSelection(delivery.planned_route_id?.trim() || '')"), 'reserva preselecionada ao liberar');
ok(inbox.includes('expectedPlannedRouteId:reservedRoute'), 'reserva convertida sob CAS ao vincular');
ok(store.includes('remoteReservation !== expectedReservation'), 'escrita de reserva detecta concorrencia remota');
ok(store.includes('transaction.update(deliveryRef, update)'), 'reserva salva em transacao sem alterar route_id');
ok(plan.includes('delivery.route_id?.trim()') && plan.includes('isCancelledSiteDelivery(delivery)'), 'pedidos finalizados/cancelados nao sao planejados');
ok(plan.includes('APPROVED.has(status)') && plan.includes('releaseAt<=now'), 'liberacao comercial e janela futura obrigatorias');
ok(ready.includes('routeDepartureActiveDeliveries'), 'contrato de saida continua separado da reserva');
ok(preapk.includes("'scripts/test-r299-p10a-future-route.cjs'"), 'novo gate mantido no PRE-APK');
ok(!ui.includes('sendWhatsApp') && !ui.includes('kickSiteRoute'), 'interface nao dispara mensageria/despacho');
console.log('R299 P10A PLANEJAMENTO ANTECIPADO:',passed,'contratos estaticos e sintaticos OK');
