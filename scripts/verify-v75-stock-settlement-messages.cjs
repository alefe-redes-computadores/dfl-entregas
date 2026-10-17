const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const ok=(value,label)=>{if(!value)throw new Error('V75: '+label);console.log('OK:',label)};

function moduleFrom(file,stubs){const source=fs.readFileSync(file,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const sandbox={module:{exports:{}},exports:{},require(id){if(id in stubs)return stubs[id];throw new Error('stub ausente: '+id)}};sandbox.exports=sandbox.module.exports;vm.runInNewContext(code,sandbox,{filename:file});return sandbox.module.exports;}

const commercial={normalizeCommercialPurchaseQuantity:(need,p)=>Math.ceil(need/Number(p?.conversion_quantity||1))};
const shopping=moduleFrom('lib/stock-shopping.ts',{'@/lib/stock-commercial':commercial,'@/lib/stock-commercial-health':{comparableBaseUnitCost:()=>0}});
const product={id:'kuat',unit:'un',current_quantity:5,minimum_quantity:5,ideal_quantity:7,presentations:[{id:'fardo',label:'Fardo com 6',purchase_unit:'fardo',conversion_quantity:6,active:true},{id:'unidade',label:'Unidade',purchase_unit:'un',conversion_quantity:1,active:true}]};
let plan=shopping.commercialPurchasePlan(product,2);
ok(plan.presentation.id==='unidade'&&plan.purchaseQuantity===2&&plan.baseQuantity===2,'falta de 2 escolhe 2 unidades, não fardo com 6');
plan=shopping.commercialPurchasePlan(product,12);
ok(plan.presentation.id==='fardo'&&plan.purchaseQuantity===2&&plan.baseQuantity===12,'falta exata de 12 prefere 2 fardos');

const analytics=moduleFrom('lib/motoboy-analytics.ts',{'@/lib/route-stops':{groupDeliveriesByStop:(items)=>items.map(item=>({deliveries:[item]}))}});
const motoboy={id:'m1',name:'Bruno',payment_rule:{type:'fixed',fixed_amount:156}};
const routes=[{id:'r1',motoboy_id:'m1',motoboy_name:'Bruno',status:'fechada',created_at:'2026-10-11T12:00:00-03:00'}];
const deliveries=[{id:'a',route_id:'r1',completed:true,payment_method:'dinheiro',is_paid:false,value:34.1,change_for:34.1},{id:'b',route_id:'r1',completed:true,payment_method:'dinheiro',is_paid:false,value:9,change_for:10}];
const data=analytics.getMotoboyDayData(motoboy,'2026-10-11',routes,deliveries,[],10);
ok(Math.abs(data.cashCollected-43.1)<.001,'valor econômico dos pedidos permanece auditável');
ok(Math.abs(data.cashInHand-44.1)<.001,'acerto usa total realmente recebido em mãos');
ok(Math.abs(data.cashHandedOverAmount-10)<.001&&Math.abs(data.retainedCash-34.1)<.001,'retorno parcial é físico e não líquido');

const page=fs.readFileSync('app/motoboys/acerto/page.tsx','utf8');
const whatsapp=fs.readFileSync('lib/whatsapp.ts','utf8');
ok(page.includes('Quanto voltou fisicamente para a loja?')&&page.includes('settlement_cash_in_hand:data.cashInHand'),'tela e auditoria usam dinheiro físico');
ok(page.includes('Pix enviado ao motoboy deve ser lançado como Adiantamento'),'Pix separado do retorno físico');
ok(whatsapp.includes("item.origin === 'ifood' && item.ifood_id")&&whatsapp.includes('PEDIR O CÓDIGO DE 4 DÍGITOS'),'mensagem agrupada prioriza ID e código');
ok(!whatsapp.includes("const equation = groupedOrders.map")&&!whatsapp.includes("const equation=groupedDeliveries.map"),'equações repetitivas removidas');
ok(whatsapp.includes('Total da parada a cobrar')&&whatsapp.includes("filter(item=>!deliveryPaid(item))")||whatsapp.includes("filter(item => !deliveryPaid(item))"),'valor só aparece quando existe cobrança');
console.log('\nV75 ESTOQUE + ACERTO + MENSAGENS: CONTRATOS OK');
