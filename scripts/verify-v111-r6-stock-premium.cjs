'use strict';
const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const read = (name) => fs.readFileSync(name, 'utf8');
const stock = read('app/estoque/page.tsx');
const archived = read('app/estoque/arquivados/page.tsx');
const details = read('app/estoque/detalhes/page.tsx');
const movement = read('app/estoque/movimentar/page.tsx');
const shopping = read('app/estoque/compras/page.tsx');
const prices = read('app/estoque/precos/page.tsx');
const draft = read('lib/stock-purchase-draft.ts');
const ok = (truth, label) => { assert(truth, label); console.log('OK:', label); };

ok(!movement.includes('state.stockProducts.filter(') && movement.includes('useMemo('), 'movimentação não cria seletor Zustand instável');
ok(!archived.includes('s.stockProducts.filter(') && archived.includes('useMemo('), 'arquivados usam seleção estável');
ok(!details.includes('s=>recentMovements(s.stockMovements') && details.includes('useMemo(()=>recentMovements(stockMovements'), 'histórico memoizado sem array novo no seletor');
ok(!details.includes('getState().stockMovements') && details.includes('buildStockRecommendation(product,stockMovements)'), 'inteligência do detalhe recebe dados reativos');
ok(details.indexOf('const rec=useMemo(') < details.indexOf('if(!product)return'), 'Hook de inteligência não depende da presença do produto');
ok(details.includes('disabled={archiving}') && archived.includes('disabled={restoringId !== null}'), 'ações destrutivas impedem toque duplo');
ok(stock.includes('requestAnimationFrame') && stock.includes('cancelAnimationFrame'), 'scroll do estoque gravado no máximo por frame');
ok(stock.includes('stockCounts.zero') && stock.includes('stockCounts.baixo'), 'contagem dos níveis do estoque consolidada');
ok(shopping.includes('invalidStockPurchaseSelections') && shopping.includes('if (invalidSelected.length)') && shopping.includes('role="alert"'), 'carrinho não ignora item inválido silenciosamente');
ok(shopping.includes('aria-invalid=') && shopping.includes('invalidSelected.length'), 'campo inválido é sinalizado antes da compra');
ok(prices.includes(".normalize('NFD')") && prices.includes('const filtered=useMemo('), 'busca de preços ignora acentos sem refiltrar em render irrelevante');

// Testa a função real TypeScript em VM, substituindo somente importações externas.
let ts;
try { ts = require('typescript'); } catch { try {ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');} catch {} }
if (ts) {
  const result = ts.transpileModule(draft, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  ok(!(result.diagnostics || []).some(x => x.category === ts.DiagnosticCategory.Error), 'núcleo de compra tem sintaxe TypeScript válida');
  // Mesma semântica do arredondamento comercial: inteiros para caixas e
  // três casas para kg e litros. O parser de entrada converte vírgula.
  const mockRequire = (id) => {
    if (id === './stock-commercial') return {
      normalizeTypedPurchaseQuantity: (value, unit) => ['un','cx','pct','fardo'].includes(unit)
        ? Math.ceil(value - 1e-9)
        : Number(Math.max(0, value).toFixed(['g','ml'].includes(unit) ? 1 : 3)),
    };
    if (id === './stock-quantity') return {
      parseStockQuantityInput: (raw) => {
        const v = raw.trim();
        const lastSep = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'));
        return Number(lastSep === -1 ? v : (v.slice(0,lastSep).replace(/[,.]/g,'') + '.' + v.slice(lastSep+1)));
      },
    };
    throw new Error('Import inesperado: ' + id);
  };
  const exports = {};
  vm.runInNewContext(result.outputText, { require: mockRequire, exports, module: {exports} });
  const validate = exports.validateStockPurchaseQuantity;
  const invalid = exports.invalidStockPurchaseSelections;
  for(const [input, unit, valid] of [
    ['0', 'un', false],['', 'kg', false],['0,0001','kg',false],
    ['0,3','kg',true],['0.3','kg',true],['0,5','l',true],
    ['1','un',true],['1,2','cx',true],['-1','un',false],
    ['abc','un',false],['1,2,3','un',false],['1.000,5','kg',true],
  ]) ok(validate(input,unit).valid===valid, `quantidade ${input || '(vazia)'} ${unit}: ${valid?'válida':'inválida'}`);
  const products = [{id:'a',unit:'un'},{id:'b',unit:'kg'}];
  ok(invalid(products,{a:true,b:true},{a:'2',b:'0'},p=>p.unit).length===1,'não omite silenciosamente item marcado com zero');
  ok(invalid(products,{a:true,b:false},{a:'2',b:''},p=>p.unit).length===0,'item desmarcado não bloqueia compra');
}
console.log('\nV111 R6 ESTOQUE + COMPRAS + PERFORMANCE: CONTRATOS OK');
