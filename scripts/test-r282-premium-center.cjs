// R282 — contratos de apresentação; não usa rede, Firestore ou dados persistidos.
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
let checks = 0;
const ok = (condition, label) => {assert.ok(condition, 'R282: '+label); checks++;};
const read = (p) => fs.readFileSync(p, 'utf8');
const center = read('app/confirmacoes/page.tsx');
const site = read('components/store/SiteInboxPanel.tsx');
const inbox = read('app/loja/caixa-de-entrada/page.tsx');
const loja = read('app/loja/page.tsx');
const pre = read('scripts/pre-apk.cjs');

// Navegação e hierarquia: duas filas explicitamente diferentes e recolhíveis.
ok(center.includes('Portal iFood · confirmações'), 'portal tem cabeçalho próprio');
ok(center.includes('Pedidos operacionais'), 'fila operacional tem cabeçalho próprio');
ok(center.includes('aria-label="Confirmações externas do iFood"'), 'portal acessível');
ok(center.includes('aria-label="Fila operacional de pedidos iFood"'), 'fila acessível');
ok(center.includes('aria-expanded={manualSectionOpen}') && center.includes('aria-expanded={operationalSectionOpen}'), 'expansões acessíveis');
ok(center.includes('id="r282-external-confirmations"') && center.includes('id="r282-operational-confirmations"'), 'alvos das expansões presentes');
ok(center.includes("setManualView('pending')") && center.includes("setManualView('resolved')"), 'histórico externo mantém abas');
ok(center.includes('onChange={(event) => setManualSearch(event.target.value)}'), 'busca externa acionável');
ok(center.includes('tokens.every((token) => fields.includes(token))'), 'busca externa combina termos');
ok(center.includes('visibleManualConfirmations.length'), 'contagem respeita filtros');
ok(center.includes('normaliz') || center.includes('normalize('), 'buscas preservam normalização');

// A ID abreviada é visual; ID/código integrais continuam em copy e transporte.
ok(center.includes('const compactOrderReference'), 'referência visual reutilizável');
ok(center.includes('compactOrderReference(item.order_id)') && center.includes('compactOrderReference(delivery.order_id)'), 'IDs extensos resumidos nos títulos');
ok(center.includes("copyValue(item.ifood_id || '', 'ID do pedido')"), 'cópia exata ID externo manual');
ok(center.includes("copyValue(confirmation.ifoodId, 'ID do pedido')"), 'cópia exata ID externo operacional');
ok(center.includes('orderConfirmationCode(item.confirmation_code'), 'código histórico segue validador');
ok(center.includes("(item.ifood_id||'').replace(/\\D/g,'')") || center.includes("(item.ifood_id || '').replace(/\\D/g, '')"), 'validação original de 8 dígitos preservada');
ok(center.includes('markManualResolved(item)') && center.includes('restoreManualPending(item)'), 'concluir e restaurar preservados');
ok(center.includes('markInvalidCode(item)'), 'rejeitar código incorreto preservado');
ok(center.includes('deleteIfoodPendingConfirmation(pendingDeleteManual.id)'), 'exclusão exige fluxo original');
ok(center.includes('getIfoodConfirmationInfo(delivery)'), 'regras de confirmação não foram substituídas');
ok(center.includes('buildConfirmationIndexes(deliveries, customers, routes)'), 'índices locais preservados');
ok(center.includes('A central organiza os pedidos que ainda estão abertos no DFL.'), 'distinção operacional/comercial mantida');
ok(!center.includes('onSnapshot('), 'nova UI não cria listener Firestore');

// Loja: acesso no contexto, sem esconder o histórico sob cadastros.
ok(loja.includes('aria-label="Acesso rápido a confirmações e histórico"'), 'atalhos na operação');
ok(loja.includes("router.push('/confirmacoes')"), 'atalho para portal');
ok(loja.includes("router.push('/loja/caixa-de-entrada?aba=site&historico=1')"), 'atalho para histórico');
ok(inbox.includes("openHistoryOnLoad={params.get('historico')==='1'}"), 'URL encaminha solicitação de histórico');
ok(site.includes('openHistoryOnLoad=false') && site.includes('useState(openHistoryOnLoad)'), 'histórico abre só no deep link');
ok(site.indexOf('Histórico do Site') < site.indexOf('shown.map(({delivery,state,duplicate}'), 'histórico não fica abaixo de dezenas de cards');
ok(site.includes('siteHistoryRows(deliveries, 200)') && site.includes('siteHistoryKind(item)'), 'histórico usa mesmas regras locais');
ok(site.includes('siteHistoryCompactId(item)') && site.includes('Mostrar ID completo'), 'referência compacta com ID integral acessível');
ok(site.includes('siteManualReviewCandidates') && site.includes('manualReferenceConfirmed'), 'reconciliação R280/R281 intacta');
ok(site.includes('allocate(delivery.id') && site.includes('siteAllocationPreflight'), 'alocação continua transacional');
ok(site.includes('archiveSiteDelivery') && site.includes('siteManualArchiveReason'), 'arquivamento seguro intacto');
ok(!site.includes('window.setInterval('), 'histórico sem polling novo');

// Novo teste entra no PRE-APK sem remover contratos anteriores.
ok(pre.includes("'scripts/test-r282-premium-center.cjs'"), 'R282 registrado no PRE-APK');
ok(pre.includes("'scripts/test-r280-r281-site-reconciliation.cjs'"), 'R281 preservada');
ok(pre.includes("'scripts/verify-v111-r68-premium-ux.cjs'"), 'R68 preservada');
for (const [name, content] of Object.entries({
  'app/confirmacoes/page.tsx':center,
  'components/store/SiteInboxPanel.tsx':site,
  'app/loja/page.tsx':loja,
  'app/loja/caixa-de-entrada/page.tsx':inbox,
})) {
  const parsed=ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ok(parsed.parseDiagnostics.length===0, `${name} sem erro JSX/TS (${parsed.parseDiagnostics.map(x=>x.messageText).join('; ')})`);
}
console.log(`R282 PREMIUM CENTRAL + HISTÓRICO: ${checks} contratos locais aprovados`);
