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

check('produto atual recebe destaque próprio', source.includes('Movimentando agora') && source.includes('{product.name}'));
check('categoria e unidade aparecem no contexto', source.includes('{product.category}') && source.includes('Unidade interna · {product.unit}'));
check('troca de produto reinicia formulário', source.includes('}, [product?.id]);'));
check('quantidade anterior é limpa', source.includes("setQuantity('');"));
check('apresentação volta para unidade interna', source.includes("setPresentationId('base');"));
check('estado visual de gravação é liberado', source.includes('setBusy(false);'));
check('trava síncrona impede toque duplo', source.includes('if (savingRef.current) return;') && source.includes('savingRef.current = true;'));
check('finally libera gravação mesmo com navegação', source.includes('finally {') && source.includes('savingRef.current = false;'));
check('fila continua avançando pelo id real', source.includes('ordered[index + 1]') && source.includes('router.replace('));
check('fim da fila continua explícito', source.includes('Conferência concluída.'));

if (failed) {
  console.error(`\nV21 MOVIMENTAÇÃO DE ESTOQUE: ${failed} contrato(s) falharam.`);
  process.exit(1);
}

console.log('\nV21 MOVIMENTAÇÃO DE ESTOQUE: contratos OK');
