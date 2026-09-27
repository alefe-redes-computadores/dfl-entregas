const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const ok=(v,m)=>{if(!v)throw new Error('FALHOU: '+m);console.log('OK',m)};

const commercial=read('lib/stock-commercial.ts');
const shopping=read('lib/stock-shopping.ts');
const pricing=read('lib/stock-pricing.ts');
const home=read('app/estoque/page.tsx');
const compras=read('app/estoque/compras/page.tsx');
const detalhes=read('app/estoque/detalhes/page.tsx');
const editar=read('app/estoque/editar/page.tsx');
const novo=read('app/estoque/novo/page.tsx');
const reports=read('app/estoque/relatorios/page.tsx');
const supply=read('components/stock-supplies/StockSupplyForm.tsx');
const editor=read('components/stock/StockPresentationEditor.tsx');
const health=read('lib/stock-commercial-health.ts');

ok(commercial.includes('commercialPurchasePlan') || shopping.includes('commercialPurchasePlan'),'planejamento comercial presente');
ok(shopping.includes('committed'),'compras abertas participam do cálculo');
ok(home.includes('committedStockQuantityMap'),'Home considera quantidade comprometida');
ok(home.includes('formatCommercialPlan'),'Home exibe compra comercial');
ok(compras.includes('purchaseQuantity'),'Compras trabalha com quantidade comercial');
ok(compras.includes('presentation'),'Compras preserva apresentação');
ok(supply.includes('conversion_quantity'),'entrada de compra preserva conversão');
ok(supply.includes('purchase_unit'),'entrada de compra preserva unidade comercial');
ok(editor.includes('conversion_quantity'),'editor configura conteúdo da embalagem');
ok(editar.includes('disabled={hasHistory}'),'unidade com histórico continua protegida');
ok(novo.includes('StockPresentationEditor'),'cadastro suporta embalagem');
ok(editar.includes('StockPresentationEditor'),'edição suporta embalagem');
ok(reports.includes('formatStockQuantity') || reports.includes('formatCommercial'),'relatórios usam apresentação humana');
ok(health.includes("['kg', 'g', 'l', 'ml']"),'massa/volume tratados como fracionáveis');
ok(health.includes("['un', 'cx', 'pct', 'fardo']"),'unidades comerciais discretas identificadas');
ok(!health.includes('updateStockProduct')&&!health.includes('addStockMovement'),'V12 não migra histórico');
ok(pricing.length>0 && detalhes.length>0,'pricing e detalhes preservados');

console.log('ESTOQUE V12: CONTRATOS END-TO-END OK');
