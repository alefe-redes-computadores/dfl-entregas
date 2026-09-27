const fs=require('fs');
const r=f=>fs.readFileSync(f,'utf8');
const must=(f,t,n)=>{if(!r(f).includes(t))throw Error(`FALHOU ${n}: ${f}`);console.log('OK',n)};
must('app/estoque/compras/page.tsx','Math.ceil(typed)','embalagem discreta inteira no create');
must('app/estoque/compras/page.tsx','purchasePlan?.purchaseQuantity || 0','UI usa quantidade comercial');
must('app/estoque/detalhes/page.tsx','formatStockQuantity(product.current_quantity,product.unit)','saldo humano');
must('app/estoque/detalhes/page.tsx','normalizedCostDisplay(product,product.average_cost||0).label','custo médio humano');
must('components/stock/StockPresentationEditor.tsx','Apresentação duplicada','alerta de duplicidade');
console.log('ESTOQUE V10: CONTRATOS OK');
