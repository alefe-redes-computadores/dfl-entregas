const fs = require('fs');

const parser = fs.readFileSync('lib/ifood-order-parser.ts', 'utf8');
const inbox = fs.readFileSync('lib/delivery-inbox.ts', 'utf8');
const nova = fs.readFileSync('app/entregas/nova/page.tsx', 'utf8');

let bad = 0;

function ok(name, value) {
  console.log(`${value ? 'OK' : 'ERRO'}: ${name}`);
  if (!value) bad++;
}

ok(
  'parser possui semântica explícita de pagamento',
  parser.includes('explicitPaid')
);

ok(
  'Pix pendente é protegido contra falso pago',
  parser.includes('pix\\s+pendente')
);

ok(
  'ID iFood tolera formato 4+4',
  parser.includes("(\\d{4})[\\s.-]?(\\d{4})")
);

ok(
  'telefone aceita prefixo +55',
  parser.includes('\\+?55')
);

ok(
  'telefone remove código 55 antes de persistir',
  parser.includes("digits.startsWith('55')")
);

ok(
  'Caixa preserva estado pago',
  inbox.includes("parsed.isPaid ? ' · pago' : ''")
);

ok(
  'Nova guarda parsed estruturado da Caixa',
  nova.includes('inboxParsedRef.current = draft.parsed')
);

ok(
  'Nova consome parsed estruturado',
  nova.includes('? [inboxParsedRef.current]')
);

ok(
  'parser textual continua como fallback',
  nova.includes(': parseIfoodOrdersText')
);

if (bad) {
  console.error(`\nV8B: ${bad} contrato(s) falharam.`);
  process.exit(1);
}

console.log('\nV8B PARSER/CAIXA: contratos estáticos OK');
