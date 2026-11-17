#!/usr/bin/env node
'use strict';
/** R80 — regressao hermetica de operacao/UX sem Firestore, rede ou envios. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let n=0;
const ok=(yes,label)=>{assert.ok(yes,'R80: '+label);n++;console.log('R80 OK:',label);};
const targets=[
  'app/confirmar/page.tsx',
  'components/customers/CustomerDestinationSheet.tsx',
  'app/entregas/nova/page.tsx',
  'app/entregas/editar/page.tsx',
  'components/deliveries/CustomerAutocomplete.tsx',
  'app/entregas/details/page.tsx',
  'lib/integration/r76KitchenPolicy.ts',
  'store/useAppStore.ts',
];
for(const path of targets){
 const src=read(path);
 const ast=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'AST '+path);
}
const portal=read(targets[0]);
ok(portal.includes('relative flex min-h-0 flex-1 flex-col bg-white'),'portal em coluna, sem sobreposicao do iframe');
ok(portal.includes('relative z-10 shrink-0 border-b border-zinc-800'),'acoes acima do portal');
ok(portal.includes('className="min-h-0 w-full flex-1 border-none"')&&!portal.includes('className="absolute inset-0 h-full w-full border-none"'),'iframe nao cobre botoes');
ok(portal.indexOf('onClick={confirmExternalAndLeave}')<portal.indexOf('<iframe'),'confirmacao acessivel antes do portal');
ok(portal.includes("isSubmitting ? 'Registrando...' : 'Funcionou · próximo'"),'feedback de baixa durante persistencia');
ok(portal.includes('if (submittingRef.current) return false;')&&portal.includes('if (!beginSubmit()) return;'),'duplo toque bloqueado');
ok(portal.includes('await completeLinkedIfoodDelivery(currentPending.delivery_id);')&&portal.includes('await updatePendingConfirmation(pendingId, {')&&portal.includes('goNextOrLeave(pendingId,'),'baixa vinculada anterior ao avancar');
ok(portal.includes('if (current.completed) return;')&&portal.includes('await updateDelivery(id,{completed:true});'),'conclusao idempotente pela store');
ok(portal.includes('error instanceof Error ? error.message'),'falha de baixa com causa visivel');
ok(portal.includes('router.replace(')&&portal.includes('readyPending(resolvedId)[0]'),'selecao sequencial assistida preservada');
ok(portal.includes("'https://confirmacao-entrega-propria.ifood.com.br'")&&portal.includes('allow-scripts allow-same-origin allow-forms'),'portal original mantido sem automacao cross-domain');
ok(!/document\.querySelector\([^)]*iframe|iframe\.contentDocument|postMessage\(/.test(portal),'nao simular autorizacao nem acesso ao portal externo');
const sheet=read(targets[1]);
ok(sheet.includes("useState(phones.length>1?'':phones[0]?.id||'')"),'multiplos telefones sem escolha automatica');
ok(sheet.includes("useState(addresses.length>1?'':addresses[0]?.id||'')"),'multiplos enderecos sem escolha automatica');
ok(sheet.includes('phoneChoiceRequired=phones.length>1')&&sheet.includes('addressChoiceRequired=addressRequired&&addresses.length>1'),'exigencia so em escolhas ambiguas');
ok(sheet.includes('aria-pressed={phoneId===item.id}')&&sheet.includes('aria-pressed={addressId===item.id}'),'contatos acessiveis e selecionaveis');
ok(sheet.includes('disabled={adding || showAdd || phoneChoiceRequired || addressChoiceRequired}')&&sheet.includes('if(phoneChoiceRequired||addressChoiceRequired)return;'),'CTA bloqueado ate selecao real');
ok(sheet.includes('role="status"')&&sheet.includes('Escolha explicitamente o endereço'),'orientacao visivel');
ok(sheet.includes("setAddressId(addresses.length>1?'':addresses[0]?.id||'')")&&sheet.includes('[customer.id]'),'troca de cliente nao reaproveita destino antigo');
ok(sheet.includes('onAddAddress')&&sheet.includes('onUseTemporary')&&sheet.includes('setAddressId(saved.id)'),'endereco permanente e temporario preservados');
ok(sheet.includes('disabled={adding||temporaryAddress.trim().length<8||phoneChoiceRequired}'),'destino temporario nao deduz telefone');
const autocomplete=read(targets[4]);
ok(autocomplete.includes('onSelect?.(customer, typedQuery)')&&autocomplete.includes('sameCustomerIdentityAddress'),'cliente exige escolha e identidade compatível');
for(const path of [targets[2],targets[3]]){
 const src=read(path);
 const label=path.includes('nova')?'Nova':'Editar';
 ok(src.includes('CustomerDestinationSheet customer={pendingContactCustomer} addressRequired={fulfillmentMode!==\'pickup\'}'),label+' distingue entrega e retirada');
 ok(src.includes('if(!applyCustomerSelection(pendingContactCustomer,phone,address))return;'),label+' seletor nao fecha ao rejeitar identidade iFood');
 ok(src.includes("toast.success('Cliente carregado.');\n    return true;"),label+' confirma selecao valida');
 ok(src.includes("toast.warning('Cliente diferente do pedido iFood.")&&src.includes('return false;'),label+' impede contato iFood incompatível');
 ok(src.includes('setPendingContactCustomer({...customer,addresses:')&&src.includes('setTemporaryCustomerId('),label+' enderecos e destino temporario preservados');
}
const detail=read(targets[5]),kitchen=read(targets[6]);
ok(detail.includes("markKitchenStage('preparing')")&&detail.includes("markKitchenStage('ready')"),'cozinha mantem preparo e pronto separados');
ok(detail.includes('kickR76KitchenStage')&&detail.includes('r76KitchenPlan'),'notificacao cozinha usa ponte existente');
ok(kitchen.includes('d.notify_whatsapp!==true||d.manual_messaging_opt_in_v1!==true'),'consentimento individual obrigatorio');
ok(kitchen.includes("reason:'site_or_external_authority'")&&kitchen.includes("reason:'terminal_order'"),'Site/marketplaces e pedidos encerrados protegidos');
ok(detail.includes("result.status==='queued'")&&detail.includes('Recebimento não confirmado.'),'fila nao se confunde com entregue no WhatsApp');
const store=read(targets[7]);
ok(store.includes('setStopPinned: async (routeId, deliveryId, pinned)')&&store.includes('withRouteOrderWriteLock('),'fixacao R78 transacional preservada');
ok(store.includes('keepPinnedStopPositions'),'reordenacao respeita posicao fixada');
const pre=read('scripts/pre-apk.cjs');
for(const script of ['scripts/test-ent-r80-fechamento-funcional.cjs','scripts/test-ent-r79-visual-final.cjs','scripts/test-ent-r78-premium360.cjs','scripts/test-r76-p1-operational-workflow.cjs','scripts/test-r76-p2-kitchen.cjs'])
 ok(pre.includes(`'${script}'`),'PRE-APK preserva '+script);
console.log(`R80 FECHAMENTO FUNCIONAL: ${n} garantias hermeticas OK; 0 rede/Firestore/WhatsApp`);
