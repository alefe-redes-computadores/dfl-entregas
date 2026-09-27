const fs=require('fs');
const r=p=>fs.readFileSync(p,'utf8');
const f={
 stock:r('app/estoque/page.tsx'),
 buy:r('app/estoque/compras/page.tsx'),
 display:r('lib/stock-commercial-display-v2.ts'),
 notif:r('lib/native/notifications.ts'),
 notifPage:r('app/mais/notificacoes/page.tsx'),
 automation:r('hooks/useStoreAutomation.ts'),
 store:r('store/useAppStore.ts'),
 loja:r('app/loja/page.tsx'),
 native:r('components/NativeRuntime.tsx'),
};
const checks=[
 ['Estoque Home usa a mesma guarda',f.stock.includes('guardedStockRecommendation(p,rec)')],
 ['Planejamento kg/L humanizado',f.display.includes('export function formatPlanningQuantity')],
 ['Compra tem explicação progressiva',f.buy.includes('Por que esta sugestão?')],
 ['Compra reduz motivo visível',f.buy.includes("'baseado na meta'")],
 ['Notificação de pedido do site existe',f.notif.includes('notifyNewSiteOrder')],
 ['Pedido do site possui deep-link',f.notif.includes('/entregas/details?id=')],
 ['Preferência de pedido do site existe',f.notif.includes('siteOrderNew: true')],
 ['Tela permite controlar pedido do site',f.notifPage.includes('Novo pedido do site')],
 ['Sync detecta pedido site novo sem scan extra',f.store.includes('newSiteOrders = fbDeliveries.filter')],
 ['Bootstrap evita tempestade de avisos antigos',f.store.includes('dfl-site-order-watch-ready')],
 ['Automação não depende de alertsEnabled',!f.automation.includes("!settings.alertsEnabled")],
 ['Loja explica divergência manual/programada',f.loja.includes('Aberta manualmente fora do horário')],
 ['Clique em notificação já navega por href',f.native.includes('localNotificationActionPerformed')&&f.native.includes('router.replace(href)')],
];
let bad=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${name}`);if(!ok)bad++;}
if(bad){console.error(`\n${bad} contrato(s) falharam.`);process.exit(1);}
console.log('\nALTA PRÉ-APK V2: contratos OK');
