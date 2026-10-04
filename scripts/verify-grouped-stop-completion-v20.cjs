const fs = require('fs');

const source = fs.readFileSync('components/home/DeliveryCard.tsx', 'utf8');
let failed = 0;

function check(label, condition) {
  if (condition) console.log(`OK: ${label}`);
  else {
    failed += 1;
    console.error(`ERRO: ${label}`);
  }
}

check('baixa usa todas as entregas pendentes da parada', source.includes("const targets = groupedDeliveries.filter((item) => !item.completed)"));
check('códigos são separados por id da entrega', source.includes('groupedCodeDrafts[item.id]'));
check('cliente correto é consultado para cada pedido', source.includes('getCustomerById(item.customer_id)'));
check('cada entrega é persistida individualmente', source.includes('await updateDelivery(item.id, updatePayload)'));
check('modal lista um campo por pedido com código', source.includes('groupedCodeDeliveries.map((item, index)'));
check('finalização agrupada exige todos os códigos', source.includes('groupedCodeDeliveries.some((item)'));
check('parada permanece identificada como uma parada física', source.includes('entregas · 1 parada física'));
check('falha parcial informa exatamente quem ficou pendente', source.includes('pendingLabels.join'));
check('fluxo unitário continua disponível', source.includes("!groupedCodeMode && <button"));
check('nenhum listener ou polling foi introduzido', !/onSnapshot|setInterval/.test(source));

if (failed) {
  console.error(`\nV20 BAIXA AGRUPADA: ${failed} contrato(s) falharam.`);
  process.exit(1);
}

console.log('\nV20 BAIXA AGRUPADA: contratos OK');
