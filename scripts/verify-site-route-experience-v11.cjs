const fs = require('node:fs');
const read = (path) => fs.readFileSync(path, 'utf8');
const files = {
  money: read('components/routes/MoneyDraftInput.tsx'),
  nova: read('app/rotas/nova/page.tsx'),
  edit: read('app/rotas/editar/page.tsx'),
  presentation: read('lib/delivery-presentation.ts'),
  address: read('lib/operational-address.ts'),
  details: read('app/entregas/details/page.tsx'),
  card: read('components/home/DeliveryCard.tsx'),
  persistence: read('lib/integration/server/siteOrderPersistence.ts'),
  types: read('types/index.ts'),
  home: read('app/page.tsx'),
};
const checks = [
  ['máscara monetária estável durante digitação', files.money.includes('inputMode="numeric"') && files.money.includes('onChange={(event) => onChange(normalizeMoneyDraft')],
  ['troco normaliza no blur', files.money.includes('onBlur={() => onChange(normalizeMoneyDraft(value))}')],
  ['nova e edição usam campo único', files.nova.includes('<MoneyDraftInput') && files.edit.includes('<MoneyDraftInput')],
  ['site usa external_order_id', files.presentation.includes('external_order_id?.trim()')],
  ['telefone brasileiro formatado', files.presentation.includes('digits.length === 11')],
  ['maps usa endereço operacional', files.presentation.includes('canonicalizeOperationalAddress')],
  ['número residencial aceita separador visual', files.address.includes('[-,/•]')],
  ['detalhe possui identidade Site', files.details.includes("channel === 'site' ? <Globe2")],
  ['card Site possui ícone próprio', files.card.includes('isSiteOrder ? <Globe2')],
  ['histórico comercial tipado', files.types.includes('site_order_timeline?: SiteOrderTimelineEntry[]')],
  ['histórico comercial idempotente', files.persistence.includes('(item) => item.event_id !== event.event_id')],
  ['fila virtual tem nome curto', files.home.includes("name: 'Pedidos sem rota'")],
  ['apresentação não consulta Firestore', !/firebase\/firestore|getDocs\(|onSnapshot\(/.test(files.presentation)],
];
let failures = 0;
for (const [label, condition] of checks) {
  console.log(`${condition ? 'OK' : 'ERRO'}: ${label}`);
  if (!condition) failures += 1;
}
if (failures) process.exit(1);
console.log('\nV11 SITE + ROTAS: ZERO ERROS');
