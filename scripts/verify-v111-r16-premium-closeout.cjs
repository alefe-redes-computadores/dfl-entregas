#!/usr/bin/env node
/** R16: smoke funcional de armazenamento, UX progressiva, reentrância e dados financeiros. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
let checks = 0;
const read = file => fs.readFileSync(path.join(process.cwd(),file),'utf8');
function ok(label, condition) { assert.ok(condition,label); checks++; console.log('OK R16:',label); }
function loadTypeScript(file, mockRequires = {}) {
  const source = read(file);
  const output = ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  ok('transpilação '+file,!(output.diagnostics||[]).some(error=>error.category===ts.DiagnosticCategory.Error));
  const mod = new Module(path.resolve(file),module);
  mod.filename=path.resolve(file);mod.paths=module.paths;
  const realRequire = mod.require.bind(mod);
  mod.require = id => id in mockRequires ? mockRequires[id] : realRequire(id);
  mod._compile(output.outputText,mod.filename);
  return mod.exports;
}
const storage = loadTypeScript('lib/stock-local-ui-storage.ts');
ok('SSR sem window: leitura nula',storage.readStockUiStorage('session','s')===null);
ok('SSR sem window: gravação opcional',storage.writeStockUiStorage('local','s','1')===false);
storage.removeStockUiStorage('local','s');ok('SSR sem window: remoção segura',true);
const locals=new Map(),sessions=new Map();
const fakeStorage = map=>({getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
global.window={localStorage:fakeStorage(locals),sessionStorage:fakeStorage(sessions)};
ok('localStorage salva preferência',storage.writeStockUiStorage('local','f','baixo'));
ok('localStorage lê preferência',storage.readStockUiStorage('local','f')==='baixo');
ok('sessionStorage independente',storage.readStockUiStorage('session','f')===null);
ok('sessionStorage salva scroll',storage.writeStockUiStorage('session','scroll','42')&&storage.readStockUiStorage('session','scroll')==='42');
storage.removeStockUiStorage('local','f');ok('remoção de preferência',storage.readStockUiStorage('local','f')===null);
Object.defineProperty(global.window,'localStorage',{get(){throw Error('SecurityError')}});
ok('bloqueio do getter não quebra leitura',storage.readStockUiStorage('local','f')===null);
ok('bloqueio do getter não quebra gravação',storage.writeStockUiStorage('local','f','x')===false);
storage.removeStockUiStorage('local','f');ok('bloqueio do getter não quebra remoção',true);
Object.defineProperty(global.window,'sessionStorage',{value:{getItem(){throw Error('restricted')},setItem(){throw Error('QuotaExceededError')},removeItem(){throw Error('restricted')}}});
ok('quota excedida / leitura negada',storage.readStockUiStorage('session','x')===null&&!storage.writeStockUiStorage('session','x','1'));
storage.removeStockUiStorage('session','x');ok('remoção com storage restrito',true);
delete global.window;
const screen=read('app/estoque/page.tsx');
ok('estado do estoque usa armazenamento resiliente', screen.includes("readStockUiStorage('session','dfl-stock-query')")&&screen.includes("readStockUiStorage('local','dfl-stock-filter')")&&screen.includes("writeStockUiStorage('session','dfl-stock-review-queue',reviewIds)"));
ok('salvar preferências de UI nunca escreve na autoridade do Firestore',!read('lib/stock-local-ui-storage.ts').includes('firebase'));
ok('limite inicial de 24 produtos por categoria', screen.includes('items.slice(0,categoryLimits[category]||24)'));
ok('acesso a TODOS os produtos por ação Ver mais',screen.includes('Math.min(items.length,(prev[category]||24)+24)'));
ok('recolher libera os cards excedentes',screen.includes('>=items.length?24:'));
ok('ordem de revisão ainda cobre catálogo inteiro',screen.includes('groups.flatMap(([,items])=>items)'));
ok('estoque não perde conteúdo por categorias minimizadas',screen.includes('!isCollapsed&&'));
const catalog=read('components/stock/StockCatalogHealth.tsx');
ok('catálogo tolera falha na persistência de ignorados',catalog.includes('writeStockUiStorage(')&&catalog.includes('removeStockUiStorage('));
ok('alertas de cadastro não duplicam ignored keys',catalog.includes('new Set([...ignored,key(id,title)])'));
const picker=read('components/stock-supplies/StockProductPicker.tsx');
ok('cadastro com trava síncrona antes de setBusy',picker.includes('if (createBusyRef.current) return')&&picker.indexOf('createBusyRef.current = true') < picker.indexOf('setBusy(true)'));
ok('trava é liberada mesmo com falha no salvamento',picker.includes('} finally {\n      createBusyRef.current = false'));
ok('cadastro ainda escreve apenas pela ação canônica',picker.includes('await addStockProduct(product)')&&picker.includes('onChange(product.id)'));
const queue=read('components/store/OperationalAttentionQueue.tsx');
ok('fila de ações carrega progressivamente',queue.includes('visible.slice(0,additionalLimit)')&&queue.includes('setAdditionalLimit(limit=>limit+20)'));
ok('fila continua navegável sem autoexecutar ações',queue.includes("router.push('/loja/caixa-de-entrada?aba=site')")&&queue.includes('onFinance()'));
ok('filtros recolhem a lista para reduzir processamento',queue.includes("setFilter(kind);setShowAll(false)"));
const money=read('lib/operational-attention.ts');
ok('fila não exibe infinito em valor inválido',money.includes('Number.isFinite(rawAmount)'));
for(const file of ['app/estoque/page.tsx','components/stock/StockCatalogHealth.tsx','components/stock-supplies/StockProductPicker.tsx','lib/operational-attention.ts','lib/stock-local-ui-storage.ts']){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok('parse TS/TSX '+file,source.parseDiagnostics.length===0);
}
const pre=read('scripts/pre-apk.cjs');
ok('R16 registrada sem remover R15/R14',pre.includes('scripts/verify-v111-r16-premium-closeout.cjs')&&pre.includes('scripts/verify-v111-r15-global-premium.cjs')&&pre.includes('scripts/verify-v111-r14-operation-premium.cjs'));
console.log(`V111 R16: ${checks} verificações aprovadas`);
