const fs=require('fs'); const must=(f,t,n)=>{const s=fs.readFileSync(f,'utf8');if(!s.includes(t))throw new Error(`FALHOU ${n}: ${f}`);console.log('OK',n)};
must('lib/stock-commercial-cost.ts','stockBaseUnitCost','custo normalizado na unidade-base');
must('lib/stock-commercial-cost.ts','commercialMigrationHint','migração assistida sem conversão cega');
must('lib/stock-commercial-cost.ts','O histórico não será convertido','proteção histórica explícita');
must('components/stock/StockPresentationEditor.tsx','movimentações antigas não são convertidas','UX avisa fronteira histórica');
must('store/useAppStore.ts','A unidade de controle não pode ser alterada porque este produto já possui histórico.','store protege unidade histórica');
must('lib/stock-shopping.ts','normalizeCommercialPurchaseQuantity','reposição usa arredondamento comercial');
console.log('CONTRATOS V6 OK');
