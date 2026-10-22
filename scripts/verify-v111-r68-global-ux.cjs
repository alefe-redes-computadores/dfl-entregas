#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=(p)=>fs.readFileSync(p,'utf8');
const paths=['components/home/OperationalCommandCenter.tsx','app/loja/caixa-de-entrada/page.tsx','components/store/SiteInboxPanel.tsx','components/home/RouteAccordion.tsx','components/home/DeliveryCard.tsx','app/estoque/compras/page.tsx'];
let checks=0;
for(const p of paths){
 const s=read(p);assert(s.length>10000,'Arquivo essencial nao pode ser truncado: '+p);checks++;
 const tree=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0,`${p} TSX invalido`);checks++;
}
const home=read(paths[0]),inbox=read(paths[1]),panel=read(paths[2]),route=read(paths[3]),card=read(paths[4]),buy=read(paths[5]);
const conditions=[
 [home.includes("label: 'Pedidos do Site'"),'acao compacta na Home'],
 [!home.includes('oldestPendingSiteOrder'),'sort e fila duplicada removidos'],
 [home.includes('siteInboxProjection(allDeliveries)'),'autoridade da Caixa preservada'],
 [home.includes('siteInboxSummary(siteInbox)') && fs.existsSync('lib/operation/siteInboxSummary.ts'),'somente avisos nao zerados'],
 [inbox.includes("channel === 'manual' &&"),'contador duplicado removido da aba Site'],
 [!inbox.includes('sitePendingCount'),'sem recalculo da projecao da Caixa na barra fixa'],
 [panel.includes('projection.total'),'contador unico da Caixa'],
 [!panel.includes('grid grid-cols-3 gap-1.5 text-center'),'metricas nao triplicadas acima dos filtros'],
 [panel.includes('aria-label="Filtrar pedidos do Site"'),'filtros continuam acessiveis'],
 [panel.includes('acknowledgeSiteOrders'),'abrir Caixa nao apaga pedido'],
 [panel.includes('allocateSiteDelivery'),'operacao transacional preservada'],
 [route.includes('!isCompleted && routeEarnings !== null'),'ganho da rota concluida so no header'],
 [!route.includes('Tempo de rota: {routeDuration}'),'duracao repetida removida'],
 [card.includes('{groupedPending} pendente') && card.includes('pedidos nesta parada'),'resumo agrupado contextual'],
 [!card.includes('groupedDeliveries.length} pedidos · {groupedPending}'),'sem quantidade duplicada no card'],
 [card.includes('orderConfirmationCode(suppliedCode || storedConfirmationCode(item))'),'baixa estrita por pedido'],
 [card.includes('storedConfirmationCode = (item: Delivery) => orderConfirmationCode(item.confirmation_code)'),'nenhum codigo de 5 digitos vira codigo falso'],
 [!card.includes("const codeToSave = (suppliedCode || storedConfirmationCode(item)).replace"),'caminho de baixa nao trunca codigo'],
 [buy.includes('Revisão rápida da compra'),'hero objetivo'],
 [buy.includes('Sugeridos ({suggested.length})'),'informacao unica no filtro'],
 [buy.includes('invalidSelected.length'),'bloqueio de quantidade invalida preservado'],
 [buy.includes('toggleVisibleSelection'),'selecao em lote preservada'],
 [!paths.some(p=>read(p).includes('collection(db,')),'UI nao cria queries Firestore novas'],
];
for(const [ok,message] of conditions){assert(ok,'R68 '+message);checks++}
const registry=read('scripts/pre-apk.cjs');
const suiteNames=[...registry.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
assert(suiteNames.length>=220,'R68 deve ter pelo menos 220 suites');checks++;
assert.equal(new Set(suiteNames).size,suiteNames.length,'PRE-APK duplicado');checks++;
for(const p of suiteNames){assert(fs.existsSync(p),'Ausente: '+p);checks++}
console.log('R68 UX + REGRESSOES: '+checks+' garantias OK; '+suiteNames.length+' suites preservadas');
