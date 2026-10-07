const fs=require('fs');
const relay=fs.readFileSync(process.env.HOME+'/projects/da-familia-lanches-v2/src/lib/integration/server/relay.ts','utf8');
const inbound=fs.readFileSync('app/api/integration/events/route.ts','utf8');
function ok(v,m){if(!v)throw new Error('V56.3 R1: '+m);console.log('OK:',m)}
ok(relay.includes('canonicalEntregasEventsUrl')&&relay.includes('/api/integration/events'),'Site canonicaliza domínio base para endpoint de eventos');
ok(relay.includes('responseFailure(response)')&&relay.includes('data.error'),'relay preserva causa segura do receiver');
ok(relay.includes('x-dfl-signature')&&relay.includes('x-dfl-timestamp'),'HMAC existente preservado');
ok(relay.includes('ensureCommercialMessagingIntent(event)'),'WhatsApp desacoplado preservado');
ok(inbound.includes("service: 'dfl-entregas-integration-events'")&&inbound.includes('export async function GET()'),'receiver possui readiness sem segredo');
ok(inbound.includes("event.event_type === 'order.created'")&&inbound.includes('consumeDflSiteOrderCreatedPersisted(event)'),'order.created continua persistido');
ok(inbound.includes('assertSignedIntegrationRequest'),'assinatura inbound preservada');
console.log('V56.3 R1 SITE ↔ ENTREGAS — CONTRATOS OK');
