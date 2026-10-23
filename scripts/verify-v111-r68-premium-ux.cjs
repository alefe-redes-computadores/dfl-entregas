// R68: visual-first regression contracts; no Firestore calls or deployment.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (name) => fs.readFileSync(name, 'utf8');
const site = read('components/store/SiteInboxPanel.tsx');
const command = read('components/home/OperationalCommandCenter.tsx');
const shift = read('components/home/ShiftBriefing.tsx');
const home = read('app/page.tsx');
const cards = read('components/home/DeliveryCard.tsx');
const nav = read('components/layout/BottomNav.tsx');
let checks = 0;
const ok = (condition, message) => {assert.ok(condition, message); checks++;};
ok(site.includes('Pedidos do Site') && site.includes('projection.total'), 'Caixa preserva contador principal');
ok(!site.includes('projection.scheduled+projection.review'), 'Caixa nao repete grades de numeros');
ok(site.includes('projection.ready') && site.includes('projection.commercial') && site.includes('projection.review'), 'Filtros seguem completos');
ok(site.includes('Pedido #{delivery.external_order_id'), 'Pedido individual continua identificado');
ok(site.includes('allocate(delivery.id'), 'Alocacao transacional preservada');
ok(command.includes('siteInboxSummary(siteInbox)'), 'Home resume apenas contagens relevantes');
ok(
  command.includes('href: siteInbox.rows.length === 1') &&
  command.includes('`/loja/caixa-de-entrada?aba=site&pedido=${encodeURIComponent(siteInbox.rows[0].delivery.id)}`') &&
  command.includes(": '/loja/caixa-de-entrada?aba=site'"),
  'Acesso da Home para a Caixa: pedido especifico e fallback'
);
ok(command.includes("key: 'broken-route-link'"), 'Corrompidos mantem acao propria');
ok(!command.includes('pendingSiteOrders = useMemo('), 'Home nao ordena backlog duplicado');
ok(shift.includes('stockAttention > 0 && <button') && shift.includes("router.push('/estoque')"), 'Estoque abertura acionavel');
ok(!shift.includes('Bebidas conferidas') && !shift.includes('Saldos sem alerta'), 'Sem placeholders de alertas resolvidos');
ok(home.includes('Faturamento do período') && home.includes('Entregas em dia'), 'Sem rótulo financeiro ambiguo na Home');
ok(cards.includes('pedidos nesta parada') && !cards.includes('pedidos · 1 parada'), 'Sem numero de pedidos duplicado no titulo');
ok(cards.includes('groupedPending'), 'Pendencias agrupadas visiveis');
ok(nav.includes('siteInboxProjection(deliveries).total'), 'Badge sincronizado nao regrediu');
ok(!read('lib/operation/siteInboxSummary.ts').includes('onSnapshot'), 'Resumo sem Firestore');
ok(!read('components/store/SiteInboxPanel.tsx').includes('window.setInterval('), 'Caixa sem polling');
const ts = require('typescript');
for (const name of ['app/page.tsx','components/home/OperationalCommandCenter.tsx','components/home/ShiftBriefing.tsx','components/home/DeliveryCard.tsx','components/store/SiteInboxPanel.tsx','lib/operation/siteInboxSummary.ts']){
 const source=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(source.parseDiagnostics.length===0, `${name}: erro TypeScript`);
}
console.log(`R68 PREMIUM UX: ${checks} garantias aprovadas`);
