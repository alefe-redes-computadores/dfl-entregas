#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let checks = 0;
const read = (path) => fs.readFileSync(path, 'utf8');
const ok = (condition, label) => {
  assert.ok(condition, `R233: ${label}`);
  checks++;
  console.log('R233 OK:', label);
};

const touched = [
  'types/index.ts',
  'components/customers/CustomerForm.tsx',
  'components/motoboys/MotoboyForm.tsx',
  'lib/motoboy-settlement-tasks.ts',
  'app/entregas/nova/page.tsx',
  'app/entregas/editar/page.tsx',
  'lib/reports/buildReportModel.ts',
  'lib/delivery-intelligence/buildOperationalIntelligence.ts',
  'lib/delivery-intelligence/buildOperationalMemory.ts',
  'lib/delivery-intelligence/buildRouteSequenceMemory.ts',
  'lib/customer-analytics.ts',
  'app/clientes/page.tsx',
  'lib/customer-recurrence.ts',
  'components/home/DeliveryCard.tsx',
  'lib/whatsapp.ts',
  'lib/route-share-card.ts',
  'app/motoboys/acerto/page.tsx',
  'components/reports/ReportChartCard.tsx',
  'lib/operation/report-eligibility.ts',
];
for (const path of touched) {
  const source = read(path);
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  ok(ast.parseDiagnostics.length === 0,
    `AST ${path}${ast.parseDiagnostics.length ? ': '+ts.flattenDiagnosticMessageText(ast.parseDiagnostics[0].messageText,' ') : ''}`);
}

const t = read('types/index.ts');
for (const marker of ['exclude_from_reports?: boolean;', 'exclude_from_rankings?: boolean;', 'exclude_from_analytics?: boolean;', 'settlement_required?: boolean;'])
  ok(t.includes(marker), `Tipo opcional, legado compatível: ${marker}`);
const helperPath = 'lib/operation/report-eligibility.ts';
const helperSource = read(helperPath);
ok(!/firebase|localStorage|updateDoc|setDoc|runTransaction|fetch\(/.test(helperSource), 'helper de elegibilidade puro, sem escrita/consulta');
const built = ts.transpileModule(helperSource, {fileName:helperPath,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleValue = {exports:{}};
vm.runInNewContext(built,{module:moduleValue,exports:moduleValue.exports,Object,Boolean}, {filename:helperPath,timeout:1000});
const {excludedFromReports,excludedFromCustomerInsights,requiresMotoboySettlement} = moduleValue.exports;
ok(!excludedFromReports({},{}), 'pedido legado sem marcador permanece nos relatórios');
ok(excludedFromReports({developer_test:true},{}), 'DEV teste fica fora dos relatórios');
ok(excludedFromReports({exclude_from_reports:true},{}), 'marcação individual tira pedido de indicadores');
ok(excludedFromReports({}, {exclude_from_analytics:true}), 'opt-out do cadastro tira pedidos da análise');
ok(!excludedFromReports({}, {exclude_from_rankings:true}), 'opt-out apenas de ranking NÃO oculta venda geral');
ok(excludedFromCustomerInsights({exclude_customer_metrics:true},{}), 'pedido operacional não entra em ranking de cliente');
ok(excludedFromCustomerInsights({}, {exclude_from_rankings:true}), 'cliente com opt-out não entra em memória/ranking');
ok(!excludedFromCustomerInsights({},{}), 'cliente real legado não é excluído por nome');
ok(requiresMotoboySettlement({}), 'padrão legado preserva acerto');
ok(!requiresMotoboySettlement({settlement_required:false}), 'motoboy sem diária não precisa registrar acerto');
ok(requiresMotoboySettlement({settlement_required:true}), 'motoboy remunerado continua com acerto');

const customerForm = read('components/customers/CustomerForm.tsx');
ok(customerForm.includes('setExcludeRankings') && customerForm.includes('setExcludeAnalytics') && customerForm.includes('exclude_from_rankings:excludeRankings') && customerForm.includes('exclude_from_analytics:excludeAnalytics'), 'form cliente persiste configurações distintas');
const clientRank = read('app/clientes/page.tsx');
ok(clientRank.includes('customer.exclude_from_rankings!==true') && clientRank.includes('!isOperationalCustomer(item.customer)'), 'rankings respeitam exclusão de cliente, preservam identidade interna');
const reports = read('lib/reports/buildReportModel.ts');
ok(reports.includes('!excludedFromReports(delivery, delivery.customer)') && reports.includes('delivery.exclude_customer_metrics !== true'), 'modelo de relatórios usa política central');
ok(reports.includes('const motoboyOperationalCurrent = dflLogisticsCurrent;'), 'logística permanece com sua própria autoridade');
const intel = read('lib/delivery-intelligence/buildOperationalIntelligence.ts');
ok(intel.includes('!delivery.exclude_customer_metrics') && intel.includes('!excludedFromReports(delivery, customerMap.get(delivery.customer_id))'), 'inteligência e qualidade excluem testes conhecidos');
const memory = read('lib/delivery-intelligence/buildOperationalMemory.ts');
ok(memory.includes('customer.exclude_from_rankings === true') && memory.includes('customer.exclude_from_analytics === true'), 'padrões recorrentes respeitam marcação do cadastro');
const stats = read('lib/customer-analytics.ts');
ok(stats.includes('customerById.get(delivery.customer_id)?.exclude_from_analytics === true'), 'índice cliente não reinclui registros de teste');
ok(read('lib/customer-recurrence.ts').includes('item.exclude_from_reports === true'), 'recorrência ignora pedidos marcados');

const newDelivery = read('app/entregas/nova/page.tsx');
const editDelivery = read('app/entregas/editar/page.tsx');
ok(newDelivery.includes('setExcludeFromReports') && (newDelivery.match(/exclude_from_reports:excludeFromReports/g)||[]).length===2, 'pedido individual e multipedido têm opção de teste');
ok(editDelivery.includes('setExcludeFromReports(delivery.exclude_from_reports === true)') && editDelivery.includes('exclude_from_reports: excludeFromReports'), 'edição permite revisar teste histórico sem exclusão física');
ok(!/deleteDoc\(/.test(helperSource), 'política não deleta pedidos históricos');

const motoboyForm = read('components/motoboys/MotoboyForm.tsx');
ok(motoboyForm.includes('Não exigir acerto financeiro') && motoboyForm.includes('settlement_required:settlementRequired'), 'dispensa de acerto configurável no cadastro');
ok(read('lib/motoboy-settlement-tasks.ts').includes('motoboy.settlement_required !== false'), 'fila de acerto respeita dispensa sem ignorar entrega real');

const card = read('components/home/DeliveryCard.tsx');
ok(card.includes('className="grid h-10 min-w-[40px] flex-1 place-items-center') && !card.includes('<span className="truncate">{copyBusy ?'), 'card compacto tem ação copiar por ícone com área de toque');
ok(card.includes("aria-label={copyBusy ? 'Copiando mensagem'") && card.includes('void copyStop();'), 'cópia preserva acessibilidade e handler');
ok(card.includes("if (dx < 0 && swipeCanCompleteOrUndo) void handleTriggerAction('complete')"), 'desfazer baixa por arrasto não foi removido');

const chart = read('components/reports/ReportChartCard.tsx');
ok(chart.includes("layout={mobileCategoryBars ? 'vertical' : 'horizontal'}") && chart.includes("dataKey={mobileCategoryBars ? 'label' : undefined}"), 'gráficos longos passam a barras horizontais');
ok(chart.includes('visibleBars = mobileCategoryBars ? chartData.slice(0, 8) : chartData') && chart.includes('onExplore'), 'gráfico compacto não perde exploração completa');

const sequence = read('lib/delivery-intelligence/buildRouteSequenceMemory.ts');
ok(sequence.includes('value >= 0.5 &&') && sequence.includes('value <= 180'), '0,0 min não vira evidência de deslocamento');
ok(sequence.includes('timedPairs += 1'), 'qualidade da amostra temporal é preservada');

const wa = read('lib/whatsapp.ts');
ok(wa.includes('IFOOD_DRIVER_CONFIRMATION_URL') && wa.includes('ifoodPortalLines('), 'iFood conserva portal e códigos individuais');
ok(!wa.includes('msg2.push(`💰 *Dinheiro da rota:* conferir a Mensagem 3`)'), 'checklist não repete recado financeiro');
ok(!wa.includes("msg2.push('   ↳ 🔴 Confirmar pelo portal ao fim do checklist.')"), 'checklist sem aviso portal por parada');
ok(wa.includes('*Cobrar:* R$ ${valueStr}') && wa.includes("📝 *Referência:* ${delivery.observation}"), 'pagamento e observação com rótulos sem ambiguidade');
const image = read('lib/route-share-card.ts');
ok(image.includes('requiredChecks') && image.includes('Sem códigos ou Pix pendentes'), 'imagem não apresenta falsa pendência de zero códigos');
const settlement = read('app/motoboys/acerto/page.tsx');
ok(settlement.includes('const displayAdjustments=existing?.settlement_adjustments||adjustments;'), 'texto/imagem usam snapshot de ajustes do registro de acerto');
ok(settlement.includes('displayAdjustments.filter(item=>item.direction') && settlement.includes('Sem descrição registrada'), 'motivos de abatimento e acréscimo aparecem após registro');
ok(settlement.includes('settlementImageRows') && settlement.includes('settlementDetailHeight') && settlement.includes('canvas.height=imageHeight'), 'imagem acerto sem bloco vazio nem corte nas primeiras três rotas');
ok(settlement.includes('settlementDirection') && settlement.includes('cashHandedOverAmount'), 'autoridade dos saldos e caixa preservada');
const pre = read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r233-report-comms-polish.cjs'"), 'PRE-APK integral passa a exigir R233');
for (const baseline of ['test-r232-final-operation-gate.cjs','test-r231-global-closeout.cjs','test-r230-offline-recovery.cjs','test-r229-r3-swipe-undo.cjs'])
  ok(pre.includes(baseline), `regressão preservada: ${baseline}`);
const store = read('store/useAppStore.ts');
ok(store.includes('allocateSiteDelivery: async (deliveryId, target) => {') && store.includes('assertSiteRouteAllocation({'), 'Site continua na Inbox com alocação transacional');
ok(store.includes('runTransaction(db, async (transaction)') && store.includes("beginOperationalWrite('stock_integration'"), 'transações e diário do estoque preservados');
console.log(`R233: ${checks} contratos aprovados. TypeScript completo e PRE-APK integral continuam obrigatórios.`);
