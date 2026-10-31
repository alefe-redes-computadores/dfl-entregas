'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = (path) => fs.readFileSync(path,'utf8');
let passed = 0;
const check = (condition, message) => { assert.ok(condition,'R228-R4: '+message);console.log('OK:',message);passed++; };
const route=read('components/home/RouteAccordion.tsx');
check(route.includes("import { createPortal } from 'react-dom';") && route.includes("import { flushSync } from 'react-dom';"), 'portal e flushSync preservados para otimizador, sem fundir imports');
check(route.includes('startViewTransition') && route.includes('prefers-reduced-motion') && route.includes('viewTransitionName'), 'animações modernas preservam preferência de movimento reduzido');
const r221=read('scripts/test-r221-mobile-route-ux.cjs');
check(r221.includes('route accordion suporta portal') && r221.includes('modal de rota acima da navegacao'), 'contratos R221 integrais preservados');
const card=read('components/home/DeliveryCard.tsx');
const r220=read('scripts/test-r220-urgent-ux.cjs');
check(card.includes("completionIconOnly ? 'min-w-[40px] flex-1 px-0' : 'min-w-[40px] flex-1 gap-1 px-1.5'") && card.includes('flex min-w-0 flex-wrap items-stretch gap-1.5'),'baixa responsiva com largura flexível');
check(r220.includes('botao de baixa adapta largura e ocupa espaco disponivel') && !r220.includes("w-10 shrink-0 px-0' :"), 'R220 testa nova largura e não CSS obsoleto');
check(r220.includes('cartao nao confirmado continua pendente') && r220.includes("'Concluído · cartão a conferir'"), 'R220 mantém exigência de pagamento confirmado explicitamente');
const home=read('app/page.tsx');
check(home.includes("paidConfirmed ? 'Concluído'") && home.includes("'Concluído · cartão a conferir'") && home.includes("'Concluído · recebimento a conferir'"),'Home não trata entrega concluída como quitação de cartão');
const r55=read('scripts/test-v111-r55-reliability.cjs');
for (const token of [
  "compile('lib/operation/site-order-alert-policy.ts')",
  "'@/lib/operation/site-order-alert-policy':siteAlertPolicy",
  'metadata:{fromCache}',
  'created_at:invalidTimestamp',
  'pedido antigo alimenta Inbox mas não alerta novamente',
  'snapshot do cache alimenta Inbox sem alerta novo',
  'timestamp inválido alimenta Inbox sem alarme fantasma',
]) check(r55.includes(token),'R55 protege cenário real: '+token.slice(0,60));
const watcher=read('components/SiteOrderNotificationWatcher.tsx');
check(watcher.includes('markUnreadSiteOrders(newUnreadIds)') && watcher.includes('!snapshot.metadata.fromCache') && watcher.includes('shouldAlertSiteOrderNow(delivery, Date.now())'), 'badge continua independente do filtro de alertas');
const policy=read('lib/operation/site-order-alert-policy.ts');
check(policy.includes('SITE_ORDER_ALERT_MAX_AGE_MS') && policy.includes('if (created === null) return false'), 'alertas antigos sem timestamp confiável permanecem barrados');
const pre=read('scripts/pre-apk.cjs');
for (const name of ['test-r228-r4-regression-compat.cjs','test-r228-r3-parser-speed-status.cjs','test-r228-r2-intelligent-routes.cjs','test-r228-operation-polish.cjs','test-r221-mobile-route-ux.cjs','test-r220-urgent-ux.cjs','test-v111-r55-reliability.cjs','test-r227-operational-fastlane.cjs']) {
  check(pre.includes("'scripts/"+name+"'"),'PRE-APK não perdeu suite '+name);
}
for (const path of ['components/home/RouteAccordion.tsx','components/home/DeliveryCard.tsx','components/SiteOrderNotificationWatcher.tsx','app/page.tsx']) {
  const code=read(path);
  const ast=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) console.error(path,ast.parseDiagnostics.slice(0,5).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')));
  check(ast.parseDiagnostics.length===0,'AST preservada '+path);
}
for (const path of ['scripts/test-r220-urgent-ux.cjs','scripts/test-v111-r55-reliability.cjs','scripts/pre-apk.cjs']) {
  check(!read(path).includes('process.exit(0)') && !read(path).includes('SKIP_R228'), 'sem desativar suíte '+path);
}
console.log(`R228-R4: ${passed} contratos aprovados.`);
