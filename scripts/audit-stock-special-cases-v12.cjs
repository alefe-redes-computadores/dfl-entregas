const fs=require('fs');
const files=[
  'app/estoque/page.tsx',
  'app/estoque/compras/page.tsx',
  'app/estoque/detalhes/page.tsx',
  'app/estoque/editar/page.tsx',
  'app/estoque/novo/page.tsx',
  'lib/stock-shopping.ts',
  'lib/stock-commercial.ts',
  'components/stock-supplies/StockSupplyForm.tsx'
];
const text=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const forbidden=[
  /batata\s*palha[^]*unit\s*[:=]\s*['"]kg['"]/i,
  /óleo[^]*unit\s*[:=]\s*['"]l['"]/i,
  /gas|gás/i
];
if(forbidden[0].test(text)) throw new Error('FALHOU: conversão hardcoded de Batata Palha detectada');
if(forbidden[1].test(text)) throw new Error('FALHOU: conversão hardcoded de Óleo detectada');
console.log('OK casos especiais permanecem orientados por cadastro, sem migração nominal automática');
