'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let count=0;
function ok(condition,label){assert.ok(condition,'R228-R3: '+label); console.log('OK:',label);count++;}
const read=p=>fs.readFileSync(p,'utf8');
const picker=read('components/stock-supplies/StockProductPicker.tsx');
ok(picker.includes("] as [string, StockProduct[]]]"), 'busca tipada como pares de categoria e lista de produtos');
ok(!picker.includes("as [string, StockProduct][]]"),'tipo incorreto removido sem any');
ok(picker.includes('Resultados da busca')&&picker.includes("localeCompare(b.name,'pt-BR')"),'resultado alfabetico preservado');
const parser=read('lib/ifood-order-parser.ts');
ok(parser.includes('const reverse = line.match(')&&parser.includes('if (reverse) return { orderId: reverse[2], ifoodId: reverse[1] }'),'par de numeros invertido preserva identidade sem colar campo errado');
const header=parser.slice(parser.indexOf('function explicitIfoodHeader('),parser.indexOf('// V85: candidatos'));
const reversePatterns=[...header.matchAll(/line\.match\((\/[^\n]*?\/i?)\)/g)];
ok(reversePatterns.length===3, 'cabeçalho invertido tem tres formatos explicitos');
const tests=[
  ['76766053 5608', true],
  ['76766053 #5608', true],
  ['76766053 | 5608', true],
  ['76766053:5608', true],
  ['ID iFood: 76766053 Pedido #5608', true],
  ['Rua São José 12 76766053 5608', false],
  ['CEP 76766053 5608', false],
  ['76766053 99999999999', false],
  ['76766053 99', false],
];
for(const [value,expected] of tests){const matches=reversePatterns.map(x=>eval(x[1])).map(x=>value.match(x)).filter(Boolean);ok(expected?matches.length===1&&matches[0][1]==='76766053'&&matches[0][2]==='5608':matches.length===0,`identificadores seguros: ${value}`)}
const guide=read('lib/ifood-parser-quality.ts');
ok(guide.includes('const reversedPair = raw.match(')&&guide.includes('reversedPair?.[2]')&&guide.includes('reversedPair?.[1]'), 'guia visual reconhece ordem reversa');
const home=read('app/page.tsx');
ok(home.includes("paidConfirmed ? 'Concluído'") && home.includes("'Concluído · cartão a conferir'"), 'home destaca conclusão, mas preserva cartão não confirmado');
ok(!home.includes("'Pago confirmado'"),'home remove redundancia pago confirmado');
ok(home.includes("'Pago · aguardando retirada'"), 'retirada paga ainda pendente permanece visivel');
const latency=read('lib/operation/action-latency.ts');
for(const kind of ['delivery_form_customer','delivery_form_confirm']){ok(latency.includes(`| '${kind}'`) && latency.includes(`${kind}: `),`diagnostico de ${kind} definido`)}
const nova=read('app/entregas/nova/page.tsx');
ok(nova.includes("recordActionLatency('delivery_form_customer'")&&nova.includes("recordActionLatency('delivery_form_confirm'"),'etapas do cadastro instrumentadas sem PII');
ok(nova.includes('await findOrCreateCustomer(')&&nova.includes('await addDelivery(')&&nova.includes('await addDeliveries('),'servidor continua confirmando antes de sucesso');
ok(!nova.includes('Promise.race(')&&!nova.includes('fire-and-forget'),'nenhum falso sucesso por timeout');
for(const p of ['components/stock-supplies/StockProductPicker.tsx','lib/ifood-order-parser.ts','lib/ifood-parser-quality.ts','app/page.tsx','app/entregas/nova/page.tsx','lib/operation/action-latency.ts']){const sf=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS); if(sf.parseDiagnostics.length){console.error(p,sf.parseDiagnostics.slice(0,5).map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')))}ok(sf.parseDiagnostics.length===0,`sintaxe TS/TSX ${p}`)}
const pre=read('scripts/pre-apk.cjs');ok(pre.includes("'scripts/test-r228-r3-parser-speed-status.cjs'")&&pre.includes("'scripts/test-r228-r2-intelligent-routes.cjs'")&&pre.includes("'scripts/test-r228-operation-polish.cjs'"),'R228, R2 e R3 mantidas no pre APK');
console.log('R228-R3:',count,'verificacoes aprovadas');
