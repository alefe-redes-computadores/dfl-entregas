#!/usr/bin/env node
/* R15 — contratos funcionais e guardas para regressões de UX/performance. */
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');
let checks = 0;
const read = p => fs.readFileSync(path.join(process.cwd(),p),'utf8');
function ok(name, value){ assert.ok(value, name); console.log('OK R15:',name); checks++; }
function load(file){
  const source = read(file);
  const result = ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  ok(`helper compilável: ${file}`, !(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error));
  const m=new Module(file,module);m.filename=path.resolve(file);m.paths=module.paths;m._compile(result.outputText,m.filename);
  return m.exports;
}
const {canonicalStockProductName} = load('lib/stock-product-identity.ts');
ok('reconhece duplicatas por acento e caixa',canonicalStockProductName('  CAFÉ  ') === canonicalStockProductName('cafe'));
ok('reconhece duplicatas por espaços internos',canonicalStockProductName('  Coca   lata  ')===canonicalStockProductName('coca lata'));
ok('não confunde tamanhos distintos',canonicalStockProductName('Coca lata')!==canonicalStockProductName('Coca 2L'));
ok('não elimina apresentação distinta',canonicalStockProductName('ovo 30 un')!==canonicalStockProductName('ovo 20 un'));
const {parseStockPanelPreferences} = load('lib/stock-panel-preferences.ts');
// A transpilação/parse não verifica os tipos de retorno usados em useState<T>.
// Este programa TypeScript real previne regressões no estado da tela de estoque.
function verifyStockPreferenceTypes() {
  const virtualPath = path.resolve('lib/__r15_preference_type_contract__.ts');
  const code = `import { parseStockPanelPreferences } from './stock-panel-preferences';
    declare function useState<T>(factory: () => T): void;
    useState<'dia'|'montar'>(() => parseStockPanelPreferences({planningTab: null}).planningTab);
    useState<'todos'|'baixo'|'zero'>(() => parseStockPanelPreferences({filter: null}).filter);
    useState<Record<string,boolean>>(() => parseStockPanelPreferences({collapsed: null}).collapsed);`;
  const options = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const realSourceFile = host.getSourceFile.bind(host);
  const realReadFile = host.readFile.bind(host);
  const realFileExists = host.fileExists.bind(host);
  const isVirtual = name => path.resolve(name) === virtualPath;
  host.getSourceFile = (name, version, onError, createNew) => isVirtual(name)
    ? ts.createSourceFile(name,code,version,true)
    : realSourceFile(name,version,onError,createNew);
  host.readFile = name => isVirtual(name) ? code : realReadFile(name);
  host.fileExists = name => isVirtual(name) || realFileExists(name);
  const program = ts.createProgram([virtualPath],options,host);
  const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(errors,{
      getCanonicalFileName: name => name,
      getCurrentDirectory: process.cwd,
      getNewLine: () => '\n'
    }));
  }
  ok('retorno da preferência é tipado para os três estados React', errors.length === 0);
}
verifyStockPreferenceTypes();

const defaults=parseStockPanelPreferences({});
ok('preferências faltantes são seguras',defaults.filter==='todos'&&defaults.planningTab==='dia'&&Object.keys(defaults.collapsed).length===0);
const valid=parseStockPanelPreferences({filter:'zero',planningTab:'montar',collapsed:'{"Bebidas":true,"Mercearia":false}'});
ok('preferências válidas continuam preservadas',valid.filter==='zero'&&valid.planningTab==='montar'&&valid.collapsed.Bebidas===true&&valid.collapsed.Mercearia===false);
for(const json of ['null','[]','false','"str"','{erro','{"Dados":0,"Ingredientes":true,"Objetos":{}}']){
 const state=parseStockPanelPreferences({filter:'invalido',planningTab:'invalido',collapsed:json});
 ok('preferência corrompida segura: '+json, state.filter==='todos'&&state.planningTab==='dia'&&Object.values(state.collapsed).every(x=>typeof x==='boolean'));
}
const closed=read('components/home/ClosedRoutesSection.tsx');
ok('histórico inicia em duas rotas',closed.includes('useState(2)')&&closed.includes('recentFirst.slice(0, visibleLimit)'));
ok('histórico avança dez sem montar tudo',closed.includes('setVisibleLimit(limit => limit + 10)'));
ok('recolher libera cards extras',closed.includes('setVisibleLimit(2)'));
ok('histórico mantém grupos e vínculo de motoboy',closed.includes('Map<string, Route[]>()')&&closed.includes('motoboyByName.get(name)'));
ok('histórico preserva ordenação temporal sem mutação',closed.includes('[...routes].sort'));
const stock=read('app/estoque/page.tsx');
ok('categoria ordena urgentes antes de itens normais',stock.includes('):prioritySort)'));
ok('busca mantém ranking pré-computado',stock.includes('const rank=new Map(visible.map('));
ok('cobertura comercial calcula status uma única vez por produto',stock.includes('commercialProductStatus(p)')&&!stock.includes('commercialCoverage([p])'));
ok('preferências recuperadas por leitura validada',stock.includes('parseStockPanelPreferences({collapsed:'));
ok('fila de revisão memorizada para não serializar por clique',stock.includes('const reviewIds=useMemo(')&&stock.includes("writeStockUiStorage('session','dfl-stock-review-queue',reviewIds)"));
ok('atenção comercial agora filtra a lista real',stock.includes('setCommercialOnly(true)')&&stock.includes('commercialAttentionIds.has(p.id)'));
ok('atenção comercial permite limpar sem sair da tela',stock.includes('setCommercialOnly(false)')&& !stock.includes('/estoque?commercial=missing'));
const picker=read('components/stock-supplies/StockProductPicker.tsx');
ok('picker inicia com trinta produtos',picker.includes('useState(30)'));
ok('picker não monta lista completa inicialmente',picker.includes('filtered.slice(0, visibleLimit)'));
ok('picker avança de trinta em trinta',picker.includes('setVisibleLimit(limit => limit + 30)'));
ok('busca reseta limite e alcança o catálogo todo',picker.includes('setQuery(event.target.value); setVisibleLimit(30)'));
ok('categorias usam lista limitada',picker.includes('groupByCategory(visibleFiltered)'));
ok('cadastro verifica duplicata por nome canônico',picker.includes('canonicalStockProductName(product.name) === canonicalStockProductName(clean)'));
ok('cadastro evita reentrada durante gravação',picker.includes('const create = async () => {\n    if (createBusyRef.current) return;')&&picker.includes('createBusyRef.current = true'));
ok('cadastro mantém operação existente',picker.includes('await addStockProduct(product)')&&picker.includes('onChange(product.id)'));
const center=read('components/home/OperationalCommandCenter.tsx');
ok('acerto de motoboy memorizado por snapshot',center.includes('const settlementTasks = useMemo(')&&center.includes('[motoboys, routes, deliveries, operationalExpenses]'));
ok('fila externa iFood preservada',center.includes('externalPending.length')&&center.includes('confirmationHref'));
const pre=read('scripts/pre-apk.cjs');
ok('regressão R15 registrada no PRE-APK',pre.includes('scripts/verify-v111-r15-global-premium.cjs'));
ok('contratos R14 continuam registrados',pre.includes('scripts/verify-v111-r14-operation-premium.cjs'));
for(const file of ['components/home/ClosedRoutesSection.tsx','components/home/OperationalCommandCenter.tsx','components/stock-supplies/StockProductPicker.tsx','app/estoque/page.tsx','lib/stock-panel-preferences.ts','lib/stock-product-identity.ts']){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok('parse TypeScript: '+file,source.parseDiagnostics.length===0);
}
console.log(`V111 R15: ${checks} contratos funcionais/estruturais aprovados`);
