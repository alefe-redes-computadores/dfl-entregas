const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const must=(f,t,label)=>{
  if(!read(f).includes(t)) throw new Error(`FALHOU ${label}: ${f}`);
  console.log(`OK ${label}`);
};

must('lib/stock-commercial.ts','ceilToPrecision','fracionável nunca arredonda abaixo');
must('lib/stock-commercial.ts','normalizeTypedPurchaseQuantity','quantidade digitada normalizada');
must('app/estoque/compras/page.tsx','?.purchaseQuantity || 0','input inicial usa unidade de compra');
must('app/estoque/compras/page.tsx','Qtd. de compra','semântica do input explícita');
must('app/estoque/compras/page.tsx','presentationIds','múltiplas apresentações preservadas');
must('app/estoque/compras/page.tsx','committedMap','compras abertas descontadas');
must('components/stock-supplies/StockSupplyForm.tsx','preferredProductIds','afinidade por fornecedor');
must('components/stock-supplies/StockSupplyForm.tsx','draftIncoming','rascunho afeta projeção');
must('components/stock-supplies/StockSupplyForm.tsx','Este produto já foi adicionado nesta compra','duplicata protegida');
must('components/stock-supplies/StockSupplyForm.tsx','beforeunload','saída acidental protegida');
must('components/stock-supplies/StockSupplyForm.tsx','popstate','voltar Android protegido');
must('lib/stock-pricing.ts','comparableBaseUnitCost','preço compara custo base equivalente');
must('lib/stock-intelligence.ts','daysUntilMinimum','dias até mínimo preservado');
must('lib/stock-intelligence.ts','coverageDays','dias até zerar preservado');
must('lib/stock-intelligence.ts','leadTimeDays','lead time preservado');
must('lib/stock-operation.ts',"'ruptura' | 'comprar_agora' | 'planejar' | 'ok'",'prioridade operacional preservada');
must('lib/stock-commercial-health.ts','stockUnitIsHistorical','histórico não reinterpretado');

const shopping=read('lib/stock-shopping.ts');
if(!shopping.includes("new Set<StockSupply['status']>(['solicitado', 'em_compra'])"))
  throw new Error('FALHOU: status comprometidos mudaram');
console.log('OK comprometimento só em compras abertas');

const store=read('store/useAppStore.ts');
if(!store.includes('FIRESTORE_INCREMENTAL_OVERLAP_MS'))
  throw new Error('FALHOU: sincronismo incremental desapareceu');
if(!store.includes('incrementalCollection('))
  throw new Error('FALHOU: helper incremental desapareceu');
console.log('OK sincronismo incremental preservado');

console.log('CONTRATOS FINAIS DO ESTOQUE: OK');
