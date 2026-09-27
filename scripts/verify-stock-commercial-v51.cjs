const fs=require('fs');
const must=(file,text,label)=>{const s=fs.readFileSync(file,'utf8');if(!s.includes(text))throw new Error(`${label}: ausente`);console.log(`OK: ${label}`)};
must('lib/stock-commercial.ts','normalizeCommercialPurchaseQuantity','utilitário comercial central');
must('lib/stock-commercial.ts','DISCRETE_PURCHASE_UNITS','unidades comerciais discretas');
must('lib/stock-shopping.ts','normalizeCommercialPurchaseQuantity(netNeed, presentation)','inteligência usa regra comercial');
must('components/stock-supplies/StockSupplyForm.tsx','Esta embalagem é comprada inteira.','form bloqueia fração impossível');
must('components/stock-supplies/StockSupplyForm.tsx','formatCommercialPlan({','UI humana centralizada');
must('components/stock/StockPresentationEditor.tsx','Como este produto é comprado?','editor comercial');
console.log('CONTRATOS V5.1 OK');
