#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const read=(file)=>fs.readFileSync(file,'utf8');
const suite=read('scripts/pre-apk.cjs');
const paths=[
 'components/home/DeliveryCard.tsx',
 'app/confirmacoes/page.tsx','app/confirmar/page.tsx',
 'lib/operation/siteInboxPolicy.ts','components/store/SiteInboxPanel.tsx',
 'components/home/OperationalCommandCenter.tsx',
 'scripts/audit-v111-r67-prepublish.cjs',
];
let checks=0;
for(const file of paths){
 assert(fs.existsSync(file));checks++;
 const text=read(file);
 if(/\.tsx?$/.test(file)){
  const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(tree.parseDiagnostics.length,0,`Parse ${file}: ${tree.parseDiagnostics.map(x=>x.messageText)}`);checks++;
 }
}
const card=read(paths[0]), list=read(paths[1]), portal=read(paths[2]);
for(const [source,label] of [[card,'DeliveryCard'],[list,'confirmacoes'],[portal,'confirmar']]){
 assert(source.includes('orderConfirmationCode'),'Codigo estrito requerido em '+label);checks++;
 assert(!/confirmation_code[^\n]*\.slice\(0,\s*4\)/.test(source),'Truncamento inseguro de codigo em '+label);checks++;
}
assert(card.includes('groupedDeliveries.every('),'So mostrar atalho de codigo se todos os pedidos sao validos');checks++;
assert(card.includes("item.origin === 'ifood'"),'Nao herdar codigo do pedido Site');checks++;
const projection=read(paths[3]);
assert(projection.includes('new Map<string, Delivery[]>()'),'ID externo indexado');checks++;
assert(projection.includes("state:'revisar', duplicate:true"),'Colisoes nao podem liberar alocacao');checks++;
assert(read(paths[4]).includes('Possível pedido duplicado'),'Colisoes explicadas na UI');checks++;
const home=read(paths[5]);
assert(home.includes('isCancelledSiteDelivery(delivery)'),'Cancelar fora das pendencias');checks++;
assert(home.includes('isDeliveryFulfillment(delivery)'),'Retirada e balcao fora das pendencias');checks++;
assert(home.includes('useMemo(() => new Set(allRoutes.map'),'Indice de rotas memoizado');checks++;
const suites=[...suite.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);
assert(suites.length>=218,'Nao reduzir suite');checks++;
assert.equal(new Set(suites).size,suites.length,'Suites duplicadas');checks++;
for(const s of suites){assert(fs.existsSync(s),`Suite faltando: ${s}`);checks++;}
for(const name of ['verify-v111-r67-consolidation','test-v111-r67-code-safety','test-v111-r67-inbox-collisions']){
 assert(suites.includes('scripts/'+name+'.cjs'),'Suite R67 ausente: '+name);checks++;
}
assert(read('security/firestore.v111-r23-owner-only.rules').includes('if superadmin();'),'Nao substituir owner-only na R67');checks++;
for(const flag of ['NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED','DFL_STAFF_OPERATION_REQUESTS_ENABLED','DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED','DFL_STAFF_PROJECTION_REFRESH_ENABLED']){
 assert(read('app/api/access/readiness/route.ts').includes(flag),'Flag ausente no diagnostico: '+flag);checks++;
}
console.log('R67 CONSOLIDACAO: '+checks+' garantias OK; '+suites.length+' suites preservadas');
