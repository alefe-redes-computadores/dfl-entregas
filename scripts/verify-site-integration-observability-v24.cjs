const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
let failed = 0;
const check = (label, value) => value ? console.log(`OK: ${label}`) : (console.error(`ERRO: ${label}`), failed++);

const store = read('store/useAppStore.ts');
const header = read('components/layout/Header.tsx');
const nav = read('components/layout/BottomNav.tsx');
const details = read('app/entregas/details/page.tsx');
const diagnostics = read('app/mais/diagnostico/page.tsx');
const api = read('app/api/integration/diagnostics/route.ts');
const outbox = read('lib/integration/server/reverseOutboxRepository.ts');

check('cabecalho exibe atualizacao relativa', header.includes('Atualizado ha ${minutes} min') && header.includes('latestSyncDiagnostic'));
check('badge nasce apenas de pedidos novos observados no sync', store.includes('markUnreadSiteOrders(newSiteOrders.map') && nav.includes('SITE_UNREAD_EVENT'));
check('abrir painel reconhece pedidos do Site', read('components/store/SiteAdminHub.tsx').includes('acknowledgeSiteOrders'));
check('ficha possui quatro estagios de integracao', details.includes('siteIntegrationStages') && details.includes('Site → Entregas → Site'));
check('divergencia e detectada sem timer remoto', store.includes('siteCompletionDivergences(mergedDeliveries)') && !store.includes('setInterval('));
check('diagnostico remoto exige usuario autorizado', api.includes('verifyIdToken') && api.includes('configured.includes(email)'));
check('reprocessamento e dirigido por eventId', api.includes('drainReverseIntegrationEventIds([eventId]'));
check('dead letter so e liberada por opcao explicita', outbox.includes('allowDeadLetter?: boolean') && api.includes('allowDeadLetter: true'));
check('diagnostico remoto nao usa polling/listener', !diagnostics.includes('setInterval(') && !diagnostics.includes('onSnapshot('));
check('contador de leitura e duracao continuam visiveis', diagnostics.includes('totalDocuments') && diagnostics.includes('durationMs'));

if (failed) {
  console.error(`\nV24 OBSERVABILIDADE: ${failed} contrato(s) falharam.`);
  process.exit(1);
}
console.log('\nV24 SITE + ENTREGAS OBSERVAVEL: CONTRATOS OK');
