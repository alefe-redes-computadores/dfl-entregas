// V109: as assertions below exercise the pure stop-finance contract with real code.
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const Module=require('module');
const ts=require('typescript');
const root=process.cwd();
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,isMain,options){
  if(request.startsWith('@/'))return originalResolve.call(this,path.join(root,request.slice(2))+'.ts',parent,isMain,options);
  return originalResolve.call(this,request,parent,isMain,options);
};
Module._extensions['.ts']=function(mod,filename){
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'), {fileName:filename,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});
  const errors=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0, errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
  mod._compile(output.outputText,filename);
};
const {summarizeStopFinance}=require('../lib/delivery-stop-finance.ts');
const {deliveryPaymentStateLabel,deliveryEconomicValue}=require('../lib/delivery-finance.ts');
const deliveries=[
  {id:'iFood',value:90,customer_charge:60,ifood_subsidy:30,payment_method:'dinheiro',is_paid:false,payment_state:'collect_on_delivery'},
  {id:'SitePix',value:35,payment_method:'pix',is_paid:false,payment_state:'pending'},
  {id:'CartaoPago',value:22,payment_method:'cartao',is_paid:true,payment_state:'paid'},
];
assert.deepEqual(summarizeStopFinance(deliveries), {economicTotal:147,customerTotal:117,collectTotal:60,pixPendingTotal:35,collectCount:1,pendingCount:1,paidCount:1,hasDifferentCustomerCharge:true});
assert.equal(summarizeStopFinance([]).collectTotal,0);
assert.equal(summarizeStopFinance([{value:0,payment_method:'pix',is_paid:false}]).hasDifferentCustomerCharge,false);
assert.equal(deliveryPaymentStateLabel({payment_method:'pix',payment_state:'pending'}),'Pix pendente');
assert.equal(deliveryPaymentStateLabel({payment_method:'dinheiro',payment_state:'pending'}),'Pagamento pendente');
assert.equal(deliveryEconomicValue({value:-42}),0);
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
assert(card.includes('isGroupedStop && isExpanded && ('),'detalhe do grupo exige expandir');
assert(card.includes("isPrivacyMode ? 'R$ •••' : `R$ ${charge.toFixed"),'valor individual segue privacidade');
assert(card.includes("troco p/ ${isPrivacyMode ? 'R$ •••'"),'troco de item agrupado segue privacidade');
assert(card.includes('groupedFinance.hasDifferentCustomerCharge'),'distingue subsídio de cobrança');
const revenue=fs.readFileSync('components/store/PerformanceModals.tsx','utf8');
assert(revenue.includes('methodTotals.pix')&&revenue.includes('deliveryEconomicValue(item)'),'métodos e lançamentos usam valor econômico canônico');
assert(revenue.includes("event.key !== 'Escape'")&&revenue.includes("document.body.style.overflow = 'hidden'"));
assert(revenue.includes('aria-pressed={filter===key}'));
console.log('V109: 12 verificações financeiras, de privacidade e UX aprovadas');
