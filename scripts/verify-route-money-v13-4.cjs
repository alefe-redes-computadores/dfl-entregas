const fs = require('fs');
const read = (path) => fs.readFileSync(path, 'utf8');
const cash = read('lib/route-cash-flow.ts');
const plan = read('lib/route-change-plan.ts');
const input = read('components/routes/MoneyDraftInput.tsx');
const edit = read('app/rotas/editar/page.tsx');
const create = read('app/rotas/nova/page.tsx');
const whatsapp = read('lib/whatsapp.ts');
const checks = [
 ['máscara brasileira central',cash.includes('moneyValueToDraft')&&cash.includes("replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')")],
 ['teclado numérico sem formatação solta',input.includes('inputMode="numeric"')&&input.includes('normalizeMoneyDraft(event.target.value)')],
 ['criar rota usa componente único',create.includes('<MoneyDraftInput')&&create.includes('parseMoneyDraft(changeMoney)')],
 ['editar usa coleção estável',edit.includes('state.motoboys);')&&!edit.includes('state.motoboys.filter(')],
 ['editar hidrata com máscara',edit.includes('moneyValueToDraft(route.change_money)')],
 ['todas as entregas em dinheiro entram no plano',!plan.includes('.filter((item) => item.requestedChange > 0)')],
 ['mensagem distingue valor exato',whatsapp.includes('Valor exato · sem troco')],
 ['mensagem detalha volta física por entrega',whatsapp.includes('formatMoney(line.tendered)')&&whatsapp.indexOf('line.tendered - line.cashChange')<0],
 ['mensagem explica total físico',whatsapp.includes('Deve voltar fisicamente na bag')],
 ['contato substitui chamar no portão',whatsapp.includes('*Contato rápido*')&&!whatsapp.includes('*Chamar no portão*')],
];
let failed=0;for(const [label,pass] of checks){console.log(`${pass?'OK':'ERRO'}: ${label}`);if(!pass)failed++;}
if(failed)process.exit(1);console.log('\nV13.4 CAIXA DA ROTA + DINHEIRO: CONTRATOS OK');
