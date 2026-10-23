const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');
let n=0;const ok=(condition,message)=>{assert.ok(condition,message);n++};
const nova=read('app/entregas/nova/page.tsx');
const source=read('lib/ifood-parser-quality.ts');
const v78=read('scripts/verify-v78-ifood-live-guide.cjs');
ok(v78.includes('Modelo iFood: #1234')&&v78.includes('Exemplo 99Food: 123456'),'modelo iFood e 99Food protegidos no V78');
ok(nova.includes('Modelo iFood: #1234 12345678')&&nova.includes('Exemplo 99Food: 123456')&&nova.includes('isFood99 ?'),'guia contextual por plataforma');
ok(nova.includes('Guia de preenchimento')&&nova.includes('deferredMagicText')&&source.includes("key: 'payment'"),'guia e parse progressivo preservados');
ok(!nova.includes('inboxParsedRef.current = draft.parsed'),'Caixa nao exige segunda acao');
const hydrate=nova.slice(nova.indexOf('inboxSeeded.current = true;'),nova.indexOf("toast.info('Rascunho carregado da Caixa de Entrada',"));
for (const field of [
  "const parsed = draft.parsed;",'setIsParserOpen(false);','inboxParsedRef.current = null;',
  "setOrderId(parsed.orderId || '');", "setCustomerName(parsed.customerName || '');",
  "setPhone(formatPhoneInput(parsed.phone || ''));", "setStreetAddress(parsed.address || '');",
  "setMapsLink(parsed.mapsLink || '');", "setValue(price ? formatCurrencyInput(",
  "setIsPaid(Boolean(parsed.isPaid));", "setDrinks((parsed.drinks || []).join(', '));",
  "setObservation((parsed.observations || []).join(' - '));",
  "setSelectedCustomerId('');", "setIfoodId(draftOrigin === 'ifood' ?",
  "setConfirmationCode(draftOrigin === 'ifood' ?",
]) ok(hydrate.includes(field),'Caixa preenche campo: '+field);
ok(hydrate.indexOf('setOrigin(draftOrigin);')<hydrate.indexOf("setOrderId(parsed.orderId || '');"),'origem escolhida antes dos dados');
const store=read('store/useAppStore.ts');
const close=store.slice(store.indexOf('      closeRoute: async'),store.indexOf('      reopenRoute: async'));
ok(close.includes("delivery.origin === 'ifood' && !isCancelledSiteDelivery(delivery) && !motoboyConfirmsIfood"),'pendencias excluem cancelados e motoboy que confirma');
ok(close.includes('id: `ifood-route-${delivery.id}`'),'fila idempotente por entrega');
ok(close.includes("item.ifood_confirmation_mode === 'motoboy'"),'politica por entregador');
ok(close.includes('if (routePendingCount > 0 && !motoboyConfirmsIfood)'),'nenhuma notificacao indevida para motoboy que confirma');
ok(close.includes('orderConfirmationCode(delivery.confirmation_code)'),'codigo por pedido, nunca memoria de cliente');
ok(!close.includes('customer?.last_confirmation_code'),'historico de cliente nao preenche codigo de outro pedido');
const driver=read('components/motoboys/MotoboyForm.tsx');
ok(driver.includes("initial?.ifood_confirmation_mode || 'store'")&&driver.includes('ifood_confirmation_mode:ifoodMode'),'legado mantem responsabilidade da loja');
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes("ifoodConfirmationMode !== 'motoboy'"),'baixa respeita motoboy');
const command=read('components/home/OperationalCommandCenter.tsx');
ok(command.includes('selfConfirmRouteIds')&&command.includes('ifood_confirmation_mode'),'alertas respeitam motoboy');
const central=read('app/confirmacoes/page.tsx');
ok(central.includes('selfConfirmRouteIds'),'central respeita motoboy');
for (const path of ['app/entregas/nova/page.tsx','components/home/DeliveryCard.tsx','components/motoboys/MotoboyForm.tsx']){
 const parsed=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,'Sintaxe TSX: '+path);n++;
}
console.log('R75-R6: '+n+' contratos executaveis/estruturais OK');
