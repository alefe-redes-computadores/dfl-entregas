'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let passed=0;
const check=(cond,label)=>{assert.ok(cond,`R74: ${label}`);passed++;console.log('OK:',label)};
const load=(path,mocks={})=>{
 const mod={exports:{}};
 const code=ts.transpileModule(read(path),{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 check(!(code.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'sintaxe: '+path);
 vm.runInNewContext(code.outputText,{module:mod,exports:mod.exports,require:key=>{if(Object.prototype.hasOwnProperty.call(mocks,key))return mocks[key];throw Error('Import nao previsto '+key)},Date,Math,Number,String,Set,Map,Boolean,console,Intl}, {filename:path});
 return mod.exports;
};
const phone=load('lib/phone.ts');
const contactBook=load('lib/customer-contact-book.ts',{'@/lib/phone':phone});
const identity=load('lib/customer-identity.ts',{'@/lib/customer-contact-book':contactBook});
const maria={id:'maria-antiga',name:'Maria R.',address:'Rua do Cedro, 104 - Alto da Serra',phone:'34999999999'};
const isolated=identity.customerIdentityEvidence(maria,'Maria',{address:'Alto da Serra'});
check(isolated.reusable===false,'Maria + bairro Alto da Serra nao vincula Maria R.');
check(identity.findExistingCustomer([maria],'Maria',{address:'Alto da Serra'})===undefined,'sem identificacao automaticamente por bairro');
check(identity.customerIdentityEvidence(maria,'Maria',{address:'Rua do Cedro, 104 - Alto da Serra'}).reusable===false,'mesmo endereco com nome parcial não vincula');
check(identity.customerIdentityEvidence(maria,'Maria R.',{address:'Rua do Cedro, 104 - Alto da Serra'}).reusable===true,'mesmo nome completo e rua numerada identifica');
check(identity.customerIdentityEvidence(maria,'Maria R.',{address:'Rua Outra, 777 - Alto da Serra'}).reusable===false,'rua e numero diferentes impedem vinculo');
// Multiple contact aliases must retain strong identity checks, without
// merging namesakes whose confirmed address conflicts with every saved address.
const aliases={id:'multi1',name:'João Silva',phone:'34988887777',address:'Rua Principal, 14 - Centro',phones:[{id:'pa',number:'34988887777',primary:true},{id:'pb',number:'34997776666',primary:false}],addresses:[{id:'aa',address:'Rua Principal, 14 - Centro',primary:true},{id:'ab',address:'Rua Alternativa, 20 - Centro',primary:false}]};
check(identity.customerIdentityEvidence(aliases,'João Silva',{phone:'34997776666',address:'Rua Alternativa, 20 - Centro'}).reusable===true,'telefone e endereco secundarios confirmam mesma identidade');
check(identity.customerIdentityEvidence(aliases,'João Silva',{phone:'34997776666',address:'Rua Distinta, 99 - Centro'}).reusable===false,'telefone conhecido nao sobrepoe endereco divergente');
const cancel=d=>d.site_order_status==='Cancelado';
const status=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR').replace(/[\s-]+/g,'_');
const policy=load('lib/operation/siteInboxPolicy.ts',{
 '@/lib/delivery-mode':{getFulfillmentMode:d=>d.fulfillment_mode||'delivery'},
 '@/lib/integration/site-order':{normalizeSiteOrderStatus:status,isCancelledSiteDelivery:cancel},
 '@/lib/scheduled-delivery':{isFutureScheduledDelivery:()=>false},
 '@/lib/operational-time':{routeOperationalDateKey:r=>r.operational_date,dateKey:()=> '2026-10-22'},
});
const base={id:'site-1',external_order_id:'100',source_system:'dfl_site',fulfillment_mode:'delivery',route_id:'',completed:false,address_string:'Rua A, 15'};
for(const accepted of ['Em Produção','em_producao','Pronto','confirmado','aceito']) check(policy.siteInboxState({...base,site_order_status:accepted},Date.parse('2026-10-22T20:00:00Z'))==='pronto','Site libera '+accepted);
for(const blocked of ['Pendente','Agendado','Cancelado','Rejeitado','desconhecido','']) check(policy.siteInboxState({...base,site_order_status:blocked},Date.parse('2026-10-22T20:00:00Z'))!=='pronto','Site bloqueia '+blocked);
const dups=policy.siteInboxProjection([{...base,site_order_status:'Em Produção'},{...base,id:'site-2',site_order_status:'Pronto'}]);
check(dups.duplicates===1&&dups.ready===0,'colisao externa nunca libera rota');
const stops=load('lib/route-stops.ts',{
 '@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},
 '@/lib/operational-address':{canonicalizeOperationalAddress:s=>({address:s||''})},
 '@/lib/customer-identity':{normalizeCustomerAddress:s=>String(s||'').toLowerCase().trim()},
});
const a={id:'urgente',route_id:'r',address_string:'Rua A, 1',is_urgent:true,order_locked:true,order_index:-99,completed:true};
const b={id:'pendente',route_id:'r',address_string:'Rua B, 2',order_index:0,completed:false};
const c={id:'finalizada',route_id:'r',address_string:'Rua C, 3',order_index:2,completed:true};
check(stops.groupDeliveriesByStop([a,b,c])[0].representative.id==='pendente','urgencia concluida vai para baixo');
const d1={...b,id:'vizinho-1',address_string:'Rua D, 4'},d2={...b,id:'vizinho-2',address_string:'Rua D, 4'};
check(stops.groupDeliveriesByStop([d1,d2]).length===1,'dois pedidos ainda sao uma parada');
const card=read('components/home/DeliveryCard.tsx');
check(card.includes('Pular este')&&card.includes('skippedCodeIds.includes(item.id)'),'cada codigo tem pulo individual');
check(card.includes('groupedCodeDeliveries.map((item, index)'),'modal exibe cliente por pedido');
check(card.includes('moveSheetOpen')&&card.includes('Mover / Fixar parada'),'movimentacao mobile em folha inferior');
check(!card.includes("className={`hidden h-9 min-w-9") && !card.includes('handleReorderPointerDown') && card.includes('role="group" aria-label="Subir ou descer parada"') && card.includes('disabled={reorderBusy || orderLocked || (position || 1) <= 1}'), 'alça removida; setas e travas presentes no mobile');
const legacy=read('scripts/verify-v111-r66-site-inbox.cjs');
check(legacy.includes('versao remota lida e revalidada dentro da mesma transacao') && legacy.includes('patch.site_order_status'),'R66 verifica autoridade comercial e revisao remota');
const store=read('store/useAppStore.ts');
check(store.includes('site_operational_payment_override')&&store.includes('transaction.update(deliveryRef, { route_id: routeId, ...patch'),'alocacao conserva documento e atualiza dados transacionalmente');
check(store.includes('keepPinnedStopPositions'),'paradas fixadas continuam protegidas');
const panel=read('components/store/SiteInboxPanel.tsx');
check(panel.includes('Revisar pedido')&&panel.includes('operational = reviewOpen'),'caixa permite revisar e escolher rota');
const persistence=read('lib/integration/server/siteOrderPersistence.ts');
check(persistence.includes('site_operational_payment_override'),'sincronizacao Site preserva ajuste operacional explicito');
const page=read('app/entregas/nova/page.tsx');
check(page.includes('Desfazer escolha')&&page.includes('typedQuery'),'cliente selecionado pode ser revertido');
check(page.includes('> Loja')&&!page.includes('> Loja Própria'),'Loja com rotulo compacto');
const home=read('app/page.tsx');
check(home.includes('if (isSyntheticOperationalRoute(route.id)) continue'),'Home nao apresenta rota sintetica como real');
const actions=read('components/home/OperationalCommandCenter.tsx');
check(actions.includes('deliveryActionHref(addressOnly[0])')&&actions.includes('deliveryActionHref(noAddress[0])'),'alerta de endereco/localizacao abre pedido especifico');
check(actions.includes('deliveryActionHref(corruptLinks[0])')&&actions.includes('deliveryActionHref(firstMissingIfoodCode)'),'vinculo e codigo iFood apontam ao pedido correto');
check(read('scripts/verify-v111-r68-premium-ux.cjs').includes('pedido especifico e fallback'),'regressao R68 valida links contextual e da Caixa');
const shift=read('components/home/ShiftBriefing.tsx');
check(shift.includes('addressReview[0]?.id')&&shift.includes('/entregas/editar?id='),'briefing abre primeira entrega sem endereco');
const pre=read('scripts/pre-apk.cjs');
check(pre.includes('scripts/test-v112-r74-macro.cjs'),'suite R74 registrada no PRE-APK');
console.log(`\nR74: ${passed} verificacoes executaveis/estruturais aprovadas`);
