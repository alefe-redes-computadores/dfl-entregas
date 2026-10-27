'use strict';
const fs=require('fs'),assert=require('assert'),ts=require('typescript');
const src=fs.readFileSync('app/rotas/page.tsx','utf8');let n=0;function ok(v,s){assert(v,s);n++}
for(const label of ['Dia anterior','Próximo dia','Escolher data das rotas','Voltar para hoje'])ok(src.includes('aria-label="'+label+'"'),label);
ok(src.includes('selectedDate !== today')&&src.includes('selectDate(today)'),'hoje contextual');
ok(src.includes('aria-pressed={filter === value}'),'filtro acessivel');
ok(src.includes('counts.rua')&&src.includes('counts[value]')&&src.includes('dayRoutes.length'),'contagens completas');
ok(src.includes('progressiveCount(rows.length, visibleLimit)'),'janela progressiva preservada');
ok(src.includes('routeOutstandingPayment(delivery)'),'financeiro preservado');
ok(src.includes('groupDeliveriesByStop(linked)'),'paradas agrupadas preservadas');
const ast=ts.createSourceFile('app/rotas/page.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);ok(!ast.parseDiagnostics.length,'TSX sem erro sintatico');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');ok(pre.includes("'scripts/test-r126-e8-route-ux.cjs'"),'gate no pre-APK');
console.log('R126 E8:',n,'contratos aprovados');
