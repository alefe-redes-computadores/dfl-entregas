#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let checks=0;
function ok(c,label){assert.ok(c,'R46: '+label);checks++}
function read(f){const src=fs.readFileSync(f,'utf8');const node=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(node.parseDiagnostics.length===0,'TS/JSX parse '+f+': '+node.parseDiagnostics.map(d=>d.messageText).join(','));return src}
const files=[
'app/loja/caixa-de-entrada/page.tsx','app/estoque/compras/page.tsx','app/estoque/page.tsx','app/rotas/page.tsx','app/entregas/page.tsx','lib/operation/inboxPresentation.ts','lib/operation/routeCollection.ts',
];
const src=Object.fromEntries(files.map(f=>[f,read(f)]));
const inbox=src['app/loja/caixa-de-entrada/page.tsx'];
for(const needle of ['classifyInboxDrafts(drafts)','inboxViewDrafts(',"setView(key)",'renderedDrafts.map((draft)','filteredDrafts.length > renderedDrafts.length','nextProgressiveCount(', 'dedupeInboxImport(incoming, drafts)','recoverInterruptedInboxDrafts(', 'saveInboxDay(',"draft.status === 'launching'",'discarded.map((draft)'])ok(inbox.includes(needle),'Caixa: '+needle);
ok(!inbox.includes('active.map((draft)'), 'Caixa: renderização não ignora limite');
ok(!inbox.includes('window.setInterval(')&&!inbox.includes('onSnapshot('),'Caixa: sem listeners novos');
const pureInbox=src['lib/operation/inboxPresentation.ts'];for(const status of ["'review'","'ready'","'launched'","'discarded'"])ok(pureInbox.includes(status),'Estados sem perda: '+status);
const purchase=src['app/estoque/compras/page.tsx'];for(const needle of ['const invalidSelected = useMemo(', 'const chosen = useMemo(', 'products, selected, quantities, purchaseUnitFor','const selectedProducts = useMemo(',"'Selecionar no filtro'",'displayed.map(product => [product.id,shouldSelect])','addStockSupply(supply)','renderedProducts.map((product)'])ok(purchase.includes(needle),'Compras: '+needle);
ok(purchase.includes('inclusive os que ainda não aparecem na tela'),'Compra em lote descreve itens ocultos');
const stock=src['app/estoque/page.tsx'];ok(stock.includes('useMemo(()=>stockValue(active),[active])'),'Estoque memoiza valuation');ok(stock.includes('value={money(estimatedStockValue)}'),'Estoque usa valuation estável');
const routes=src['app/rotas/page.tsx'];for(const needle of ['routeOutstandingPayment(delivery)','if (outstanding.pending)','pendingCharge += outstanding.amount','pendingPayments++','Valor dos pedidos','A receber: R$','const deliveriesByRoute = useMemo(','groupDeliveriesByStop(linked).length','state !== \'finalizadas\''])ok(routes.includes(needle),'Rotas: '+needle);
const deliveries=src['app/entregas/page.tsx'];for(const needle of ['const paymentState = deriveDeliveryPaymentState(delivery)','paymentState === \'paid\'','Recebido','A receber','isCancelledSiteDelivery(delivery)','deliveryPaymentStateLabel(delivery)'])ok(deliveries.includes(needle),'Entregas: '+needle);
const payment=src['lib/operation/routeCollection.ts'];for(const needle of ['isCancelledSiteDelivery(delivery)','deriveDeliveryPaymentState(delivery)','deliveryCustomerCharge(delivery)','pending: false','pending: true'])ok(payment.includes(needle),'Cobrança: '+needle);
const pre=read('scripts/pre-apk.cjs');const tests=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);ok(tests.length>=174,'no mínimo 174 suítes preservadas');ok(new Set(tests).size===tests.length,'nenhuma suíte duplicada');for(const f of tests)ok(fs.existsSync(f),'suíte existe: '+f);
const rules=fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8');ok(rules.includes('if superadmin();'),'Rules owner-only continuam intactas');
console.log(`R46 GLOBAL: ${checks} contratos OK`);
