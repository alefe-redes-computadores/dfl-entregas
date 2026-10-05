const fs = require('fs');

const source = fs.readFileSync('app/estoque/movimentar/page.tsx', 'utf8');
let failed = 0;

function check(label, condition) {
  if (condition) console.log(`OK: ${label}`);
  else {
    failed += 1;
    console.error(`ERRO: ${label}`);
  }
}

check('seleção explica unidade de digitação', source.includes('Como você vai informar?') && source.includes('Escolha a unidade usada na digitação.'));
check('unidade interna usa nome humano', source.includes('Direto em {quantityLabel(product.unit)}'));
check('conversão 1 para 1 não repete equação', source.includes('Formato de compra · mesma quantidade'));
check('prévia duplicada foi removida', !source.includes('Prévia: <b'));
check('resultado possui título semântico', source.includes('Saldo após esta movimentação'));
check('campo acompanha apresentação escolhida', source.includes('Quantidade de ${quantityLabel(selectedPresentation.purchase_unit)}'));
check('saldo insuficiente aparece durante digitação', source.includes('quantity.trim() && insufficientStock'));
check('saída maior permanece bloqueada', source.includes('stockExitExceeds(rawAmount, product.current_quantity, product.unit)'));
check('compra pendente é vinculada pelo produto', source.includes('item.stock_product_id === product.id'));
check('ação abre a compra exata', source.includes('/abastecimentos/detalhes?id=${pendingSupply.id}'));
check('mercadoria pendente não é somada ao saldo', source.includes('ainda não lançada'));
check('falso vermelho foi eliminado', !source.includes('event.preventDefault();\n\n    setAttempted(true);'));
check('erro real ainda produz feedback', source.includes('if (quantityInvalid) {\n      setAttempted(true);\n      void feedbackError();'));

if (failed) {
  console.error(`\nV21.1 CLAREZA DA MOVIMENTAÇÃO: ${failed} contrato(s) falharam.`);
  process.exit(1);
}

console.log('\nV21.1 CLAREZA DA MOVIMENTAÇÃO: contratos OK');
