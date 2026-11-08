#!/usr/bin/env node
'use strict';
// R299 P2 - test hermetico, sem rede, Firestore, WhatsApp ou alteracao de clientes.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let checks=0;
function ok(cond,label){assert.ok(cond,`R299 P2: ${label}`);checks++;console.log('OK R299 P2:',label)}
const read=p=>fs.readFileSync(p,'utf8');
const files=[
 'app/page.tsx',
 'components/customers/CustomerForm.tsx',
 'app/clientes/page.tsx',
 'app/clientes/duplicados/page.tsx',
 'app/clientes/details/page.tsx'
];
for(const file of files){
 const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(!parsed.parseDiagnostics.length,`AST JSX ${file} (${parsed.parseDiagnostics.map(x=>x.messageText).join(', ')})`);
}
const home=read(files[0]);
for(const x of ["const isKeetaPlatform = isPlatform && order.origin === 'keeta'", "isKeetaPlatform ? 'Entrega Keeta' : 'Entrega 99Food'", "isKeetaPlatform?'bg-violet-500/10 text-violet-300'"])ok(home.includes(x),'Home diferencia Keeta e 99Food: '+x);
const form=read(files[1]);
for(const x of ["['ifood','iFood',Smartphone]","['food99','99Food',ShoppingBag]","['keeta','Keeta',ShoppingBag]","['loja','Loja',Store]","value==='keeta'?'bg-violet-500 text-white'",'setOrigin(value)','exclude_from_rankings:excludeRankings','exclude_from_analytics:excludeAnalytics'])ok(form.includes(x),'formulario preserva '+x);
ok(!/(?:getDocs|onSnapshot|runTransaction|setDoc)\s*\(/.test(form),'formulario nao adiciona consultas diretas');
const list=read(files[2]);
for(const x of ['const [compactCards,setCompactCards]=useState(true)', 'ranked.slice(0,5)','<details className="group rounded-[26px]','<summary className="mb-2 flex', 'aria-pressed={compactCards}', '{!compactCards&&<div', "['keeta','Keeta']", 'customerOrigin===\'keeta\''])ok(list.includes(x),'listagem preserva '+x);
const dup=read(files[3]);
for(const x of ['const allCandidates = useMemo(', 'const candidates = useMemo(', 'groupsCount', 'value={search}', 'setVisibleCount(30)', 'candidates.slice(0, visibleCount).map', 'Toque para comparar','<details className="group">','mergeCustomers(source.id, target.id)','mergeInFlight.current'])ok(dup.includes(x),'revisao preserva '+x);
ok(!/\b(?:getDocs|onSnapshot|runTransaction|setDoc)\s*\(/.test(dup),'duplicados nao adicionam acesso remoto direto');
const detail=read(files[4]);
ok(detail.includes('const [historyLimit,setHistoryLimit]=useState(8)'), 'ficha inicia com historico compacto');
ok(detail.includes('stats.deliveries.slice(0,historyLimit)')&&detail.includes('setHistoryLimit(value=>value+24)'), 'ficha preserva navegacao progressiva de pedidos');
ok(detail.includes("customer.origin==='keeta'?'Keeta':'Loja'"), 'ficha preserva identidade Keeta R299 P1');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r299-clientes-p2.cjs'")&&pre.includes("'scripts/test-r299-core-p1.cjs'"),'PRE-APK inclui P1 e P2');
console.log(`R299 P2 APROVADA: ${checks} validacoes locais, zero rede e sem modificacao de dados.`);
