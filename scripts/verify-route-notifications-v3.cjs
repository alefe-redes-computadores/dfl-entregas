const fs=require('fs'),r=p=>fs.readFileSync(p,'utf8');
const n=r('lib/native/notifications.ts'),s=r('store/useAppStore.ts'),t=r('types/index.ts'),o=r('components/RouteOperations.tsx');
const c=[
['autor da saída',t.includes('started_by_uid?: string')&&t.includes('started_by_name?: string')],
['início notifica',n.includes('notifyRouteStarted')&&s.includes('notifyRouteStarted(')],
['motoboy != executor',s.includes('startedByName')&&s.includes('current.motoboy_name')],
['lembrete 60 min',n.includes('60 * 60_000')&&n.includes('Rota aberta há bastante tempo')],
['lembrete sobrevive reload',o.includes('scheduleRouteDurationReminder')],
['finalizar cancela lembrete',s.includes('cancelRouteDurationReminder(routeId)')],
['fim inclui duração',n.includes('routeDurationText(details.startedAt')],
['fim inclui paradas/pedidos',s.includes('stops: groupDeliveriesByStop(routeDeliveries).length')&&s.includes('orders: routeDeliveries.length')],
['sem nova leitura firestore',!n.match(/getDocs\(|onSnapshot\(/)],
['preferência início',n.includes('routeStarted: boolean')&&n.includes('routeStarted: true')]
];let bad=0;for(const[x,v]of c){console.log(`${v?'OK':'ERRO'}: ${x}`);if(!v)bad++}if(bad)process.exit(1);console.log('\nNOTIFICAÇÕES DE ROTA V3: contratos OK');
