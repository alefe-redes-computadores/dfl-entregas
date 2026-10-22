#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let count = 0;
const check=(value,message)=>{assert.ok(value,message);count+=1;};
const read=(file)=>fs.readFileSync(file,'utf8');
const sources=[
  'app/entregas/page.tsx','app/rotas/page.tsx','app/rotas/details/page.tsx',
  'app/loja/page.tsx','app/loja/caixa-de-entrada/page.tsx',
  'app/clientes/page.tsx','app/estoque/compras/page.tsx',
  'lib/customer-analytics.ts','lib/delivery-inbox.ts',
];
for(const file of sources){
  const src=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  check(src.parseDiagnostics.length===0,`${file}: sintaxe TypeScript/JSX inválida`);
  check(!read(file).includes('window.setInterval(') && !read(file).includes('onSnapshot('), `${file}: nova sincronização automática`);
}
const client=read('app/clientes/page.tsx');
const customer=read('lib/customer-analytics.ts');
check(client.includes('buildCustomerStatsIndex(customers, deliveries)'), 'Clientes não usa índice único');
check(!client.includes('getCustomerStats(customer,deliveries)'), 'Clientes continua N x M');
check(customer.includes('if (delivery.customer_id)') && customer.includes('knownIds.has'), 'Identidade forte do cliente deve prevalecer');
check(customer.includes('delivery.exclude_customer_metrics')&&customer.includes('delivery.developer_test'), 'Contagem deve excluir dados de teste');
const inbox=read('app/loja/caixa-de-entrada/page.tsx');
const dedupe=read('lib/delivery-inbox.ts');
check(inbox.includes('dedupeInboxImport(incoming, drafts)'), 'Caixa não deduplica lote');
check(dedupe.includes('if (seen.has(key))') && dedupe.includes('textKeys.has(weak)'), 'Deduplicação forte e legado devem existir');
check(inbox.includes('saveInboxDay(') && inbox.includes('recoverInterruptedInboxDrafts('), 'Persistência offline da caixa ausente');
const details=read('app/rotas/details/page.tsx');
check(details.includes("route?.status === 'fechada' ? 0 : 8"), 'Rota encerrada deve recolher sequência');
check(details.includes('Mostrar mais')&&details.includes('Recolher sequência'), 'Expansão reversível deve permanecer');
check(details.includes('RouteDepartureChecklist'), 'Checklist de saída preservado');
const routes=read('app/rotas/page.tsx');
check(routes.includes("state !== 'finalizadas'"), 'Rota fechada ainda renderiza progresso expandido');
check(routes.includes('groupDeliveriesByStop'), 'Paradas não podem virar N entregas soltas');
check(routes.includes('deliveryCustomerCharge')&&routes.includes('deliveryEconomicValue'), 'Financeiro da rota preservado');
const deliveries=read('app/entregas/page.tsx');
check(deliveries.includes('deriveDeliveryPaymentState(delivery)'), 'Entrega concluída confundida com paga');
check(deliveries.includes('deliveryPaymentStateLabel(delivery)'), 'Estado financeiro ausente no card');
check(deliveries.includes('isCancelledSiteDelivery(delivery)'), 'Cancelados não tratados');
check(deliveries.includes('getFulfillmentMode(delivery)'), 'Modalidades logística/balcão/retirada não diferenciadas');
const shopping=read('app/estoque/compras/page.tsx');
check(shopping.includes('displayed.slice(0, visibleLimit)'), 'Compra sem renderização progressiva');
check(/selectedProducts\s*=\s*(?:useMemo\(\(\)\s*=>\s*)?products\.filter/.test(shopping) && shopping.includes('invalidStockPurchaseSelections('),'Selecionar e validar NÃO pode ignorar itens fora da tela (com ou sem memo)');
check(shopping.includes('displayed.map(product => [product.id,shouldSelect])'), 'Seleção em lote deve considerar TODO filtro');
check(shopping.includes('addStockSupply(supply)'), 'Fluxo de compra original preservado');
const store=read('app/loja/page.tsx');
check(store.includes('pendingDeliveries')&&store.includes('selectedDateRoutes'), 'Resumo operacional da Loja não informa prioridades');
check(store.includes("router.push('/estoque')")&&store.includes("router.push('/clientes')"), 'Acesso Loja a Estoque e Clientes preservado');
const preapk=read('scripts/pre-apk.cjs');
const suite=[...preapk.matchAll(/^  '(scripts\/[^']+)',?$/gm)].map(m=>m[1]);
check(suite.length>=161,`PRE-APK deve conter >=161 suites, encontrou ${suite.length}`);
check(new Set(suite).size===suite.length,'PRE-APK com testes duplicados');
check(suite.includes('scripts/verify-v111-r40-global-operation.cjs')&&suite.includes('scripts/test-v111-r40-business-regression.cjs'), 'R40 não registrada no PRE-APK');
console.log(`R40 GLOBAL: ${count} contratos sintáticos, operacionais, financeiros e de compatibilidade OK`);
