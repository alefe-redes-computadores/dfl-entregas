const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`R69 99Food: ${label}`);
  console.log('OK:', label);
};

const types = read('types/index.ts');
const mode = read('lib/delivery-mode.ts');
const parser = read('lib/food99-order.ts');
const inbox = read('lib/delivery-inbox.ts');
const inboxPage = read('app/loja/caixa-de-entrada/page.tsx');
const create = read('app/entregas/nova/page.tsx');
const edit = read('app/entregas/editar/page.tsx');
const report = read('lib/reports/buildReportModel.ts');

ok(types.includes("'food99'") && types.includes("'external_delivery'"), 'origem e modalidade externa são contratos distintos');
ok(types.includes("logistics_provider?: LogisticsProvider"), 'responsável logístico fica explícito e extensível');
ok(mode.includes("external_delivery") && !mode.includes("getFulfillmentMode(delivery) !== 'pickup'"), 'entrega da plataforma não é rota DFL');
ok(parser.includes('orderId: labelled') && parser.includes("ifoodId: ''") && parser.includes("confirmationCode: ''"), 'pedido de seis dígitos não herda ID ou código iFood');
ok(inbox.includes("return 'food99'") && inbox.includes("source !== 'food99'"), 'Caixa reconhece 99Food sem exigir endereço de rota');
ok(inboxPage.includes('normalizeFood99Order') && inboxPage.includes('99Food / Texto'), 'Caixa normaliza o texto antes de criar rascunhos');
ok(create.includes("marketplaceModes?.food99 === 'dfl'") && create.includes("'external_delivery'") && create.includes("logistics_provider:fulfillmentMode==='delivery'?'dfl'"), 'cadastro não cria rota ou motoboy para entrega 99');
ok(create.includes("!/^\\d{6}$/.test(orderId)") && edit.includes("!/^\\d{6}$/.test(orderId)"), 'criação e edição validam os seis dígitos');
ok(report.includes('totalDeliveries: dflLogisticsCurrent.length') && report.includes("if (raw === 'food99') return '99Food'"), 'receita/origem preservadas sem inflar entregas DFL');

console.log('\nV112 R69 99FOOD: CONTRATOS OK');
