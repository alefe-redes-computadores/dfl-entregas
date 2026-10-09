const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`V58: ${label}`);
  console.log('OK:', label);
};

const card = read('components/home/DeliveryCard.tsx');
const store = read('store/useAppStore.ts');

const trigger = card.slice(
  card.indexOf("async function handleTriggerAction"),
  card.indexOf("const orderLocked"),
);
const completion = store.slice(
  store.indexOf("[route-kick:delivery] fast lane concluída") - 700,
  store.indexOf("deleteDelivery: async"),
);

ok(card.includes('const impact = (style: ImpactStyle)') && card.includes('void Haptics.impact'), 'haptica operacional é não bloqueante');
ok(trigger.includes('impact(ImpactStyle.Light)') && !trigger.includes('await Haptics.impact'), 'modal do código abre sem aguardar plugin nativo');
ok(completion.includes('void kickSiteRoute') && !completion.includes('await kickSiteRoute'), 'baixa não aguarda retries da ponte com o Site');
ok(completion.includes('void currentState.closeRoute') && !completion.includes('await currentState.closeRoute'), 'baixa não aguarda fila iFood e fechamento completo');
ok(store.includes('await batch.commit();') && store.includes('deliveryCommitCompleted = true'), 'confirmação local continua durável antes do pós-processamento');
ok(card.includes('A confirmação externa do iFood continua separada.'), 'interface explica separação entre código e portal');

console.log('\nV58 BAIXA IFOOD SEM DELAY: CONTRATOS OK');
