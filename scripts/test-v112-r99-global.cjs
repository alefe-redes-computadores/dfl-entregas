'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('typescript');
const file=(p)=>fs.readFileSync(p,'utf8');
const source=file('lib/operation/searchR99.ts');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const api={};vm.runInNewContext(js,{exports:api});
const {matchesOperationSearch,normalizeOperationSearch}=api;
assert.equal(normalizeOperationSearch('Árvore / São José'),'arvore sao jose');
assert.equal(matchesOperationSearch('Rota Centro · João', 'joao rota'),true);
assert.equal(matchesOperationSearch('Rota Centro · João','marcos'),false);
assert.equal(matchesOperationSearch('Maria (34) 99123-4567','991234567'),true);
assert.equal(matchesOperationSearch('João · compras','joao compras'),true);
assert.equal(matchesOperationSearch('Rota 12',''),true);
const team=file('app/equipe/page.tsx');assert(team.includes('activeWritesRef.current.has(key)'));assert(team.includes('savingRef.current'));assert(team.includes('Limpar busca de equipe'));
const routes=file('app/rotas/page.tsx');assert(routes.includes('matchesOperationSearch'));assert(routes.includes('Limpar busca de rotas'));assert(routes.includes('const searchTerm = useMemo(') && routes.includes('includes(searchTerm)'), 'R14: preservar caminho rapido original');
const clients=file('app/clientes/page.tsx');assert(clients.includes('Limpar busca de clientes'));assert(clients.includes('clientes encontrados') || clients.includes('cliente{filtered.length'));
const confirmations=file('app/confirmacoes/page.tsx');assert(confirmations.includes('readyForPortalCount'));assert(confirmations.includes('R99: informação local'));
const reports=file('app/relatorios/page.tsx');assert(reports.includes('ranking derivado'));
assert(team.includes('Limpar</button>}'));assert(confirmations.includes('Limpar</button>}'));
for (const p of ['app/equipe/page.tsx','app/rotas/page.tsx','app/clientes/page.tsx','app/confirmacoes/page.tsx','app/relatorios/page.tsx']) {
 const tree=ts.createSourceFile(p,file(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0, 'JSX invalido em '+p+': '+tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(', '));
}
console.log('DFL V112 R99-R3 — CONTRATOS GLOBAIS + R14: OK');
