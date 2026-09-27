const fs=require('fs');
const path=require('path');
const read=f=>fs.readFileSync(f,'utf8');
const must=(f,t,label)=>{
  if(!fs.existsSync(f)) throw new Error(`ARQUIVO AUSENTE: ${f}`);
  if(!read(f).includes(t)) throw new Error(`CONTRATO AUSENTE [${label}] em ${f}`);
  console.log(`OK ${label}`);
};

console.log('--- STORE / FIRESTORE ---');
must('store/useAppStore.ts','FIRESTORE_INCREMENTAL_OVERLAP_MS','overlap incremental');
must('store/useAppStore.ts','incrementalCollection','sync incremental');
must('store/useAppStore.ts',"'routes'","rotas no sync");
must('store/useAppStore.ts',"'deliveries'","entregas no sync");
must('store/useAppStore.ts',"'stock_movements'","movimentos no sync");
must('store/useAppStore.ts',"'ifood_pending_confirmations'","iFood pendente no sync");
must('store/useAppStore.ts','if (get().isSyncing) return','sync concorrente bloqueado');

console.log('--- HOME / OPERAÇÃO ---');
must('app/page.tsx','useMemo','Home memoizada');
must('app/page.tsx','OperationalCommandCenter','central operacional');
must('app/page.tsx','ShiftBriefing','briefing de turno');
must('lib/operational-time.ts','SYNTHETIC_OPERATIONAL_ROUTE_IDS','rotas sintéticas identificadas');
must('lib/operational-time.ts','isSyntheticOperationalRoute','rota sintética não vira saída real');

console.log('--- ENTREGAS / ROTAS ---');
must('app/entregas/page.tsx','operationalDate','data operacional');
must('app/entregas/page.tsx','FulfillmentMode','modalidade de atendimento');
must('app/rotas/page.tsx','router','navegação de rotas');

console.log('--- IFOOD ---');
must('app/confirmacoes/page.tsx','ifood','Central iFood');
must('store/useAppStore.ts','ifoodPendingConfirmations','fila iFood');

console.log('--- ESTOQUE ---');
must('lib/stock-intelligence.ts','daysUntilMinimum','dias até mínimo');
must('lib/stock-intelligence.ts','coverageDays','dias até zerar');
must('lib/stock-intelligence.ts','leadTimeDays','lead time');
must('lib/stock-shopping.ts','committed','compras abertas comprometidas');
must('lib/stock-operation.ts',"'ruptura' | 'comprar_agora' | 'planejar' | 'ok'",'prioridade operacional');
must('app/estoque/compras/page.tsx','normalizeTypedPurchaseQuantity','quantidade comercial');
must('app/estoque/compras/page.tsx','presentationIds','múltiplas apresentações');

console.log('--- NOTIFICAÇÕES ---');
must('app/mais/notificacoes/page.tsx','purchasePlanning','planejamento de compras');
must('app/mais/notificacoes/page.tsx',"'12:00'",'horário padrão compras');
must('app/mais/notificacoes/page.tsx','closingReview','conferência estoque');
must('app/mais/notificacoes/page.tsx',"'23:30'",'horário padrão estoque');
must('app/mais/notificacoes/page.tsx','ifoodPending','alerta iFood');
must('app/mais/notificacoes/page.tsx','routeOpenReminder','rota aberta');

console.log('CONTRATOS CENTRAIS PRÉ-APK: OK');
