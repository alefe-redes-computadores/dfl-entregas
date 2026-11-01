'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ok=(value,msg)=>{assert.ok(value,'R230: '+msg);console.log('R230 OK:',msg)};
function load(path,contextExtra={}) {
 const source=read(path);
 const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,'TS sintaticamente correto: '+path);
 const js=ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 const ctx={module,exports:module.exports,Math,Date,Set,Number,JSON,Map,Error,Array,Object,String,...contextExtra};
 vm.runInNewContext(js,ctx,{filename:path,timeout:4000});
 return module.exports;
}
const policy=load('lib/operation/reconnect-policy.ts');
const input={wasOffline:true,online:true,authenticated:true,hydrated:true,syncing:false,
 elapsedSinceLastAttemptMs:policy.RECONNECT_COOLDOWN_MS,hasSyncError:true,hasUnverifiedWrite:false};
ok(policy.mayReconcileAfterReconnect(input),'reconcilia só com erro conhecido e rede retornando');
ok(!policy.mayReconcileAfterReconnect({...input,syncing:true}),'não concorre com sync ativo');
ok(!policy.mayReconcileAfterReconnect({...input,wasOffline:false}),'não refaz consultas a cada montagem');
ok(!policy.mayReconcileAfterReconnect({...input,elapsedSinceLastAttemptMs:policy.RECONNECT_COOLDOWN_MS-1}),'cooldown impede tempestade');
ok(policy.mayReconcileAfterReconnect({...input,hasSyncError:false,hasUnverifiedWrite:true}),'pendência após reinício pode provocar releitura conservadora');
ok(!policy.mayReconcileAfterReconnect({...input,authenticated:false}),'não sincroniza sem login');
ok(!policy.mayReconcileAfterReconnect({...input,hydrated:false}),'não mistura snapshots antes de hidratar');
const storage=new Map(),listeners=[];
const win={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},dispatchEvent:e=>listeners.push(e.type)};
const journal=load('lib/operation/operational-write-journal.ts',{window:win,Event:class Event{constructor(type){this.type=type}}});
const owner='admin-uid-1',other='admin-uid-2';
const token=journal.beginOperationalWrite('delivery',owner);
ok(typeof token==='string'&&journal.readWriteJournal(owner).length===1,'registro local imediato sem dados de pedido');
ok(journal.readWriteJournal(other).length===0,'isolamento entre contas');
ok(![...storage.values()].join('').includes(owner),'UID não gravado em texto');
const raw=[...storage.values()].join('');
ok(!raw.includes('customer')&&!raw.includes('address')&&!raw.includes('amount'),'nenhum dado de cliente/valor/endereço');
journal.finishOperationalWrite(owner,token,'confirmed');
ok(journal.writeJournalSummary(journal.readWriteJournal(owner)).confirmed===1,'confirmado só após retorno da Promise');
const token2=journal.beginOperationalWrite('purchase',owner);
const stale=journal.sanitizeWriteJournal([{token:token2,kind:'purchase',status:'pending',at:new Date().toISOString()}]);
// O token segue vivo nesta sessão; outro token persistido de sessão encerrada é incerto.
const unverified=journal.sanitizeWriteJournal([{token:'wabcdef-12345',kind:'purchase',status:'pending',at:new Date().toISOString()}]);
ok(stale[0].status==='pending'&&unverified[0].status==='unverified','não confunde operação viva com pendente após reinício');
journal.finishOperationalWrite(owner,token2,'failed');
ok(journal.writeJournalSummary(journal.readWriteJournal(owner)).failed===1,'erro preservado sem falso sucesso');
ok(journal.sanitizeWriteJournal([{token:'wabcdef-12345',kind:'delivery',status:'confirmed',at:'invalid'}]).length===0,'storage inválido não contamina UI');
let calls=0;
journal.observeOperationalWrite('stock_movement',owner,async()=>{calls++;return 4}).then(async value=>{
 ok(value===4&&calls===1,'envoltório preserva valor e executa uma vez');
 try{await journal.observeOperationalWrite('stock_integration',owner,async()=>{throw new Error('off')});assert.fail('falha engolida');}
 catch(e){ok(e.message==='off','erro transacional propagado, sem auto-replay');}
 const store=read('store/useAppStore.ts');
 for(const token of ['beginOperationalWrite(\'route_order\'','beginOperationalWrite(\'delivery\'','beginOperationalWrite(\'purchase\'','beginOperationalWrite(\'stock_movement\'','beginOperationalWrite(\'stock_integration\''] )ok(store.includes(token),'store instrumenta '+token);
 ok(store.includes('assertFreshRemoteImportIds('),'importação plataforma continua idempotente');
 ok(store.includes('queueDeliveryDocuments(queueEntityWrite, normalized.map((delivery) => delivery.id), () => batch.commit())'),'fila/lock não alterados');
 ok(store.includes('runTransaction(db, async (transaction)'), 'transações Firestore preservadas');
 const layout=read('app/layout.tsx');ok(layout.includes('<ConnectivityRecovery />'),'banner de conectividade integrado à shell');
 const diag=read('app/mais/diagnostico/page.tsx');ok(diag.includes('acknowledgeUnverifiedWrites(user.uid)'),'revisão manual explícita');
 ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r230-offline-recovery.cjs'"),'PRE-APK inclui R230');
 const genericExample = 'const incrementalCollection = <T>(items: T[]) => items;';
 ok(ts.createSourceFile('generic.ts',genericExample,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS).parseDiagnostics.length===0,'type generico puro nao e JSX');
 ok(ts.createSourceFile('generic.ts',genericExample,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length>0,'teste impede regressao de parser TSX para .ts');
 for(const p of ['components/operation/ConnectivityRecovery.tsx','app/mais/diagnostico/page.tsx','store/useAppStore.ts','app/layout.tsx']){
  const kind = p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,kind);
  ok(ast.parseDiagnostics.length===0, 'AST '+p+(ast.parseDiagnostics.length ? ': '+ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ') : ''));
 }
 console.log('R230: reconexão, isolamento, diário e autoridade remota APROVADOS');
}).catch(e=>{console.error(e);process.exitCode=1});
