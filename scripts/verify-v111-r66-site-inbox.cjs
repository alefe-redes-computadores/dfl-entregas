const fs = require('fs');
const read = file => fs.readFileSync(file,'utf8');
let n=0; const ok=(result,name)=>{if(!result)throw new Error('R66: '+name);n++;};
const policy=read('lib/operation/siteInboxPolicy.ts');
const panel=read('components/store/SiteInboxPanel.tsx');
const inbox=read('app/loja/caixa-de-entrada/page.tsx');
const home=read('app/page.tsx');
const actions=read('components/home/OperationalCommandCenter.tsx');
const store=read('store/useAppStore.ts');
const notifications=read('lib/native/notifications.ts');
const navbar=read('components/layout/BottomNav.tsx');
const attention=read('components/store/OperationalAttentionQueue.tsx');
const attentionPolicy=read('lib/operational-attention.ts');
const tests=[
[policy.includes("source_system !== 'dfl_site'"),'somente pedidos Site'],
[policy.includes('isCancelledSiteDelivery'),'cancelamento excluido'],
[policy.includes("getFulfillmentMode(delivery) !== 'delivery'"),'balcao e retirada excluidos'],
[policy.includes('isFutureScheduledDelivery'),'agendamento bloqueado'],
[policy.includes('RELEASED.has(status)'),'status comercial positivo explicito'],
[policy.includes('routeOperationalDateKey(route)'),'rota no dia de operacao'],
[policy.includes('route.started_at'),'rota iniciada bloqueada'],
[policy.includes('delivery.address_string'),'endereco obrigatorio'],
[policy.includes('siteInboxProjection'),'projecao sem nova colecao'],
[panel.includes('siteInboxProjection(deliveries,clock)'),'Caixa usa Delivery existente'],
[panel.includes('allocateSiteDelivery'),'alocacao por transacao'],
[panel.includes('newRoute'),'criar rota na Caixa'],
[panel.includes('routeId:selection'),'rota existente na Caixa'],
[panel.includes('acknowledgeSiteOrders'),'marcacao de aviso nao apaga pendencia'],
[panel.includes('focusedId'),'deep link para pedido'],
[panel.includes('useAppStore'),'dados ja sincronizados'],
[inbox.includes('SiteInboxPanel'),'nova aba integrada a Caixa'],
[inbox.includes("channel==='manual'"),'rascunhos iFood/WhatsApp preservados'],
[!home.includes("routesDoDia.push({ id: 'rota-site-aguardando-confirmacao'"),'sem rota ficticia site'],
[!home.includes("routesDoDia.push({ id: 'rota-aguardando-vinculo'"),'sem rota ficticia sem vinculo'],
[!home.includes("routesDoDia.push({ id: 'rota-resgate-recuperada'"),'rota corrompida nao e rota ficticia'],
[actions.includes('siteInboxProjection(allDeliveries)'),'Home usa mesmo backlog'],
[actions.includes('broken-route-link'),'vinculo corrompido vira alerta'],
[actions.includes('/loja/caixa-de-entrada?aba=site'),'acao Home abre Caixa'],
[notifications.includes('/loja/caixa-de-entrada?aba=site&pedido='),'notificacao abre pedido na Caixa'],
[navbar.includes('siteInboxProjection(deliveries).total'),'badge deriva do Firestore sincronizado'],
[attention.includes("site_dispatch')router.push('/loja/caixa-de-entrada?aba=site')"),'atencao navega para a Caixa'],
[attentionPolicy.includes("siteState === 'pronto'"),'agenda ou status nao liberado nao aparece como despachavel'],
[store.includes('allocateSiteDelivery: async'),'API de alocacao no Store'],
[store.includes('runTransaction(db, async (transaction) =>'),'alocacao transacional'],
[store.includes('const deliverySnap = await transaction.get(deliveryRef)'),'leitura do pedido na transacao'],
[store.includes('const routeSnap = await transaction.get(routeRef)'),'leitura da rota na transacao'],
[store.includes('assertSiteRouteAllocation(remoteDelivery, route'),'verificacao da versao remota dentro da transacao'],
[store.includes('transaction.update(deliveryRef, { route_id: routeId, updated_at: nowIso })'),'somente atributos logisticos alterados'],
[store.includes("if ('newRoute' in target) transaction.set(routeRef"),'nova rota criada atomicamente'],
[store.includes('deliveryMutationLocks.add(`site-allocate:${deliveryId}`)'),'bloqueio clique duplo'],
[!store.slice(store.indexOf('allocateSiteDelivery: async'),store.indexOf('updateDelivery: async')).includes('kickSiteRoute('),'alocacao nao dispara site saiu para entrega'],
[!store.slice(store.indexOf('allocateSiteDelivery: async'),store.indexOf('updateDelivery: async')).includes('setDoc('),'sem escrita solta fora da transacao'],
];
for (const [condition,name] of tests)ok(condition,name);
console.log('R66 SITE -> CAIXA -> ROTA: '+n+' garantias estruturais OK');
