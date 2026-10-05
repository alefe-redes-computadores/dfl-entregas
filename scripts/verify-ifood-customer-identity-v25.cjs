const fs = require('fs');

const page = fs.readFileSync('app/entregas/nova/page.tsx', 'utf8');

const checks = [
  ['rascunho preserva endereço individual', 'address:item.address||parsed.address'],
  ['rascunho preserva telefone individual', "phone:item.phone||''"],
  ['rascunho preserva Maps individual', "mapsLink:item.mapsLink||''"],
  ['salvamento normaliza endereço de cada pedido', "canonicalizeOperationalAddress(draft.address||streetAddress)"],
  ['cliente recebe endereço do próprio pedido', "address:fulfillmentMode==='delivery'?draftAddress:undefined"],
  ['entrega recebe endereço do próprio pedido', "address_string:fulfillmentMode==='delivery'?draftAddress:''"],
  ['endereços diferentes não são agrupados à força', 'const shouldGroupStop = Boolean(stopSource);'],
  ['cadastro espera sincronização inicial', "if(isSyncing){toast.info('Aguarde a atualização dos clientes terminar.'"],
];

let failed = false;
for (const [label, needle] of checks) {
  if (!page.includes(needle)) {
    console.error(`ERRO: ${label}`);
    failed = true;
  } else {
    console.log(`OK: ${label}`);
  }
}

if (failed) process.exit(1);
console.log('\nV25 IDENTIDADE IFOOD: CONTRATOS OK');
