/* R55 - contratos conservadores: UI, rotas reais, isolamento e navegacao. */
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = (file) => fs.readFileSync(file, 'utf8');
const home = read('app/page.tsx');
const command = read('components/home/OperationalCommandCenter.tsx');
const store = read('app/loja/page.tsx');
const more = read('app/mais/page.tsx');
const preferences = read('app/mais/preferencias/page.tsx');
let checks=0;
function ok(name, condition) { assert.ok(condition, `R55 FALHOU: ${name}`); checks++; }
for (const file of ['app/page.tsx','components/home/OperationalCommandCenter.tsx','app/loja/page.tsx','app/mais/page.tsx','app/mais/preferencias/page.tsx']) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0, `${file}: erro sintatico TSX`);
  checks++;
}
ok('Home: prioridades operacionais mantidas', home.includes('<OperationalCommandCenter routes={routesDoDia} deliveries={deliveriesDoDia} />'));
ok('Home: rotas aparecem antes de balcao/retirada', home.indexOf('{openRoutes.length > 0 && (') > -1 && home.indexOf('{openRoutes.length > 0 && (') < home.indexOf('{storeOrdersDoDia.length > 0 && !globalMotoboy && ('));
ok('Home: rotas antes da busca secundária', home.indexOf('{openRoutes.length > 0 && (') < home.indexOf('aria-label="Ferramentas de consulta"'));
ok('Home: busca nao removida', home.includes('homeToolsOpen &&') && home.includes('<OperationalAssistant dayDeliveries={deliveriesDoDia}') && home.includes('<OperationalDemandCard />'));
ok('Home: filtro de motoboy mantido', home.includes('setGlobalMotoboy(m.name)') && home.includes('globalMotoboy === m.name'));
ok('Home: contador financeiro e privacidade', home.includes('Faturamento do período') && home.includes('togglePrivacyMode'));
ok('Home: entrega e rota preservam periodo', home.includes('href={`/entregas?date=${encodeURIComponent(selectedDateKey)}`}') && home.includes('href={`/rotas?date=${encodeURIComponent(selectedDateKey)}`}'));
ok('Home: retiradas nao geram vazio falso', home.includes('routesDoDia.length === 0 && storeOrdersDoDia.length === 0'));
ok('Home: rastros e componentes de rotas', home.includes('RouteAccordion key={route.id}') && home.includes('<ClosedRoutesSection'));
ok('Home: pedidos da loja consultáveis', home.includes('storeOrdersDoDia.slice(0, storeOrdersVisibleLimit)') && home.includes('setStoreOrdersOpen'));
ok('Prontidao nao some sem alertas', command.includes('visibleRows.length === 0') && command.includes('Prontidão e dinheiro nas rotas'));
const zeroStart = command.indexOf('if (visibleRows.length === 0)');
const withStart = command.indexOf('aria-label="Prioridades e pulso operacional"');
ok('Dinheiro presente com e sem prioridades', command.slice(zeroStart, withStart).includes('<RouteCashPulse') && command.slice(withStart).includes('<RouteCashPulse'));
ok('Prontidao presente com e sem prioridades', command.slice(zeroStart, withStart).includes('<OperationReadiness') && command.slice(withStart).includes('<OperationReadiness'));
ok('Pulso financeiro usa rotas carregadas', command.includes('cashPulseRoutes') && command.includes('deliveries={deliveries}'));
ok('Site e acertos usam projeções reais', command.includes('siteInboxProjection(allDeliveries)') && command.includes('settlementQueueSummary(settlementTasks)'));
ok('Loja: Site e Caixa nao escondidos', store.includes('<SiteAdminHub') && store.includes('Pedidos do Site') && store.includes("router.push('/loja/caixa-de-entrada')"));
ok('Loja: abrir e fechar continua no motor real', store.includes('id="dfl-loja-abertura"') && store.includes('onClick={toggleStore}'));
ok('Loja: expediente junto da abertura', store.includes('Editar expediente') && store.indexOf('Editar expediente') < store.indexOf('Operação do dia'));
ok('Loja: editor de semana continua canônico', store.includes('id="dfl-loja-expediente"') && store.includes('setIsScheduleEditorOpen(true)') && store.includes('saveDayEditor'));
ok('Loja: valores atuais de configuracoes sob demanda', store.includes('Conferir valores atuais') && store.includes('aria-label="Resumo das preferências operacionais"'));
ok('Loja: preferencias seguem gravadas no mesmo registro', store.includes('updateStoreSettings(patch)') && store.includes('handleSaveAllSettings'));
for (const [route,label] of [['/abastecimentos','compras'],['/estoque','estoque'],['/despesas','despesas'],['/clientes','clientes'],['/equipe','equipe'],['/motoboys','motoboys'],['/confirmacoes','confirmacao']]) {
  ok(`Loja: ${label} continua navegavel`,store.includes(`router.push('${route}')`));
}
ok('Loja: Site e historico direto',store.includes("router.push('/loja/caixa-de-entrada?aba=site')")&&store.includes('historico=1'));
ok('Mais: preferencias e notificacoes',more.includes('/mais/preferencias')&&more.includes('/mais/notificacoes')&&more.includes('/mais/atualizacoes'));
ok('Mais: admin continua protegido',more.includes('isDiagnosticsAdmin')&&more.includes('/mais/comunicacao'));
ok('Preferencias: ordem manual e plataformas no store',preferences.includes('routeOrderingMode')&&preferences.includes('mergeMarketplacePreference'));
ok('Novos scripts sem listeners remotos', !/\b(onSnapshot|runTransaction|setDoc|updateDoc)\s*\(/.test(read('scripts/check-r55-premium360.cjs')));
ok('A R54 ainda faz parte do PRE-APK externo', fs.existsSync('scripts/check-r54-premium360.cjs'));
console.log(`R55_PREMIUM360_OK: ${checks} garantias; 5 componentes TSX parseados.`);
