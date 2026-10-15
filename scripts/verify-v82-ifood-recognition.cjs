const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`V82: ${label}`);
  console.log('OK:', label);
};

const quality = read('lib/ifood-parser-quality.ts');
const page = read('app/entregas/nova/page.tsx');
const parser = read('lib/ifood-order-parser.ts');

ok(quality.includes('buildIfoodRecognitionSummary'), 'resumo visual usa uma autoridade reutilizável');
ok(quality.includes('order.confirmationCode') && quality.includes('Código ${order.confirmationCode}'), 'código de confirmação fica visível');
ok(quality.includes('order.phone') && quality.includes('Telefone identificado'), 'telefone reconhecido fica visível');
ok(quality.includes('Cupom iFood') && quality.includes('order.subsidy'), 'cupom/subsídio fica visível');
ok(quality.includes('Troco para') && quality.includes('order.changeFor'), 'troco fica visível');
ok(quality.includes('order.drinks.join') && quality.includes('order.observations.length'), 'bebidas e observações ficam visíveis');
ok(quality.includes('order.routeNumber') && quality.includes('order.motoboyHint'), 'rota e motoboy ficam visíveis');
ok(quality.includes("orders.length > 1 ? `${index + 1} · `"), 'múltiplos pedidos recebem identificação individual');
ok(page.includes('Composição do pedido') && page.includes('cliente paga') && page.includes('cupom iFood'), 'composição financeira explica cliente + cupom + total');
ok(page.includes("item.tone==='financial'") && page.includes("item.tone==='logistics'") && page.includes("item.tone==='attention'"), 'cores distinguem dinheiro, logística e atenção');
ok(parser.includes('(?:cupom|subs[ií]dio|desconto\\s+ifood|ifood\\s+paga|ifood\\s+subsidia)'), 'parser preserva aliases de cupom iFood');
ok(!page.includes('liveParsedOrders[0];\n    if (!parsed) return []'), 'painel não limita o resumo ao primeiro pedido');

console.log('\nV82 IFOOD RECONHECIMENTO COMPLETO: CONTRATOS OK');
