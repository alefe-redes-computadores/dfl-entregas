const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const memo = new Map();
function load(file) {
  if (memo.has(file)) return memo.get(file).exports;
  const mod = { exports: {} }; memo.set(file, mod);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  assert.equal(output.diagnostics.length, 0, `Erros de sintaxe em ${file}`);
  new Function('require', 'module', 'exports', output.outputText)((name) => {
    if (name.startsWith('@/lib/')) return load(path.posix.join('lib', name.slice(6) + '.ts'));
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const { planStockMovement, planStockCount } = load('lib/stock-mutation-plan.ts');
const original = { id:'x1',name:'Hambúrguer',unit:'un', current_quantity:10,average_cost:4,updated_at:'old' };
const now='2026-10-17T15:00:00-03:00';
const draft={ id:'delivery-x1',product_id:'x1',product_name:'', type:'saida',quantity:2,occurred_at:now,expected_balance:10 };
const decrease=planStockMovement(original,draft,now);
assert.equal(decrease.record.balance_before,10);
assert.equal(decrease.record.balance_after,8);
assert.equal(decrease.changed.current_quantity,8);
assert.equal('expected_balance' in decrease.record,false, 'snapshot não persistido');
assert.equal(decrease.record.product_name,'Hambúrguer');
assert.equal(original.current_quantity,10, 'planejador é puro');
assert.throws(()=>planStockMovement({...original,current_quantity:9},draft,now),/mudou em outro aparelho/);
// Movimentações automáticas sem snapshot usam sempre saldo mais recente do servidor.
assert.equal(planStockMovement({...original,current_quantity:9},{...draft,expected_balance:undefined},now).changed.current_quantity,7);
assert.throws(()=>planStockMovement({...original,current_quantity:1},{...draft,expected_balance:undefined},now),/Saldo insuficiente/);
assert.equal(planStockMovement({...original,current_quantity:2},{...draft,expected_balance:2,quantity:2.00000001},now).changed.current_quantity,0);
assert.equal(planStockMovement({...original,current_quantity:0},{...draft,type:'entrada',quantity:2,unit_cost:8,expected_balance:0},now).changed.average_cost,8);
assert.equal(planStockMovement(original,{...draft,type:'entrada',quantity:2,unit_cost:7},now).changed.average_cost,4.5);
assert.equal(planStockMovement(original,{...draft,type:'contagem',quantity:0},now).changed.current_quantity,0);
assert.throws(()=>planStockMovement(original,{...draft,type:'saida',quantity:0},now),/Quantidade inválida/);
assert.throws(()=>planStockMovement(original,{...draft,type:'entrada',quantity:0.00001},now),/pequena demais/);
assert.throws(()=>planStockMovement(original,{...draft,type:'entrada',quantity:NaN},now),/Quantidade inválida/);
assert.throws(()=>planStockMovement(original,{...draft,unit_cost:Infinity},now),/Custo informado inválido/);
assert.throws(()=>planStockMovement({...original,current_quantity:-1},draft,now),/Saldo inválido/);
assert.throws(()=>planStockMovement(original,{...draft,product_id:'outro'},now),/Identificação/);
const countItems=[{product_id:'x1',quantity:3,expected_quantity:10},{product_id:'x2',quantity:0,expected_quantity:4}];
const x2={...original,id:'x2',name:'Tomate',current_quantity:4,unit:'kg'};
const counted=planStockCount(countItems,new Map([['x1',original],['x2',x2]]),'count-operation',now,{id:'employee',name:'Equipe'});
assert.equal(counted.changed.length,2);
assert.deepEqual(counted.records.map(item=>[item.balance_before,item.balance_after]),[[10,3],[4,0]]);
assert.equal(counted.records[0].team_member_name,'Equipe');
assert.equal(new Set(counted.records.map(row=>row.id)).size,2);
assert.throws(()=>planStockCount(countItems,new Map([['x1',{...original,current_quantity:11}],['x2',x2]]),'other',now),/mudou em outro aparelho/);
assert.throws(()=>planStockCount([countItems[0],countItems[0]],new Map([['x1',original]]),'same',now),/duplicado/);
assert.throws(()=>planStockCount([{...countItems[0],quantity:-3}],new Map([['x1',original]]),'c',now),/inválida/);
assert.throws(()=>planStockCount([{...countItems[0],expected_quantity:undefined}],new Map([['x1',original]]),'c',now),/inválido/);
assert.throws(()=>planStockCount([countItems[0]],new Map(),'c',now),/não encontrado/);
assert.throws(()=>planStockCount(Array(201).fill(countItems[0]),new Map([['x1',original]]),'c',now),/entre 1 e 200/);
const store=fs.readFileSync('store/useAppStore.ts','utf8');
const movement=store.slice(store.indexOf('addStockMovement: async (movement) => {'),store.indexOf('integrateStockSupply: async (id) => {'));
const count=store.slice(store.indexOf('countStockProducts: async (counts, responsible) => {'),store.indexOf('addDelivery: async (delivery) => {'));
for (const [part,name] of [[movement,'movimentação'],[count,'contagem']]) {
  assert.match(part,/runTransaction\(db/,`${name} usa transação`);
  assert.match(part,/transaction\.get\(/,`${name} lê servidor`);
  assert.doesNotMatch(part,/writeBatch\(db/,`${name} não usa batch não condicional`);
  assert.match(part,/set\(\(state\) =>/,`${name} atualiza state após commit`);
  assert(part.indexOf('await runTransaction(db') < part.indexOf('set((state) =>'),`${name}: write confirmado antes do state`);
}
assert.match(movement,/lastServerRead:\s*\{ current: StockProduct \| null \}/,'snapshot do servidor tipado para callback Firestore');
assert.match(movement,/const fresh = lastServerRead\.current;/,'snapshot do catch continua tipado');
assert.match(movement,/priorMovement\.exists\(\)/,'IDs de movimentos deduplicados no servidor');
assert.match(movement,/alreadyExisted: true/,'movimento remoto já registrado hidrata a store local');
assert.match(movement,/if \(result\.alreadyExisted\) return/,'movimento existente não duplica notificação');
assert.match(count,/planStockCount\(/,'contagem usa planejador canônico');
const countUI=fs.readFileSync('app/estoque/contagem/page.tsx','utf8');
const movementUI=fs.readFileSync('app/estoque/movimentar/page.tsx','utf8');
assert.match(countUI,/expected_quantity:baseline\[p\.id\]/,'snapshot preservado na sessão de contagem');
assert.match(countUI,/const products=useMemo\(/,'lista da contagem memorizada');
assert.match(countUI,/JSON\.stringify\(\{values,baseline\}\)/,'snapshot sobrevive a reinício');
assert.match(movementUI,/expected_balance: product\.current_quantity/,'movimentação manual envia saldo exibido');
assert.doesNotMatch(count,/set\(\{ stockProducts: previousProducts/,'sem rollback global apagando alterações alheias');
console.log('V100.4: 31 contratos de autoridade, concorrência, contagem, estoque e idempotência OK');
