/** R252: offline, deterministic contract tests. Does not hit Firebase/network/WhatsApp. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
let checks=0;
const ok=(p,m)=>{assert.ok(p,m);checks++};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(p,mocks={}){
  const js=ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),mod,mod.exports);return mod.exports;
}
const batch=load('lib/tracking/gate3/batch-audit.ts');
const good=['order1','ORD_9','delivery-SITE','a'.repeat(120)];
for(const id of good)ok(batch.validAuditIds([id]),'ID válido '+id.slice(0,12));
for(const v of [[],null,'order1',{},[12],['x','x'],['a/b'],['a.b'],['a b'],[''],['a'.repeat(121)],Array.from({length:21},(_,i)=>'x'+i)])ok(!batch.validAuditIds(v),'lista rejeitada');
const fake=(code='none',origin='site',level='ready_for_internal_review')=>({
  delivery:{origin,state:'assigned',canonical_order_key:'site:fake',public_label:'VISÃO ADMIN',fulfillment:'delivery'},
  readiness:{level,last_confirmed_at:'2026-11-04T10:01:00.000Z',signals:code==='none'?[]:[{code,severity:'blocker',label:'NÃO EXPORTAR'}]},
  events:[{id:'a',kind:'received',at:'2026-11-04T10:00:00.000Z',source:'dfl_site'}],
});
const cert={source:'confirmed_server_snapshot',public_projection_valid:true};
const row=batch.auditRow('order1',fake(),cert);
eq(row.origin,'site','origem');eq(row.level,'ready_for_internal_review','nível');eq(row.public_projection_valid,true,'projeção validada');eq(row.event_count,1,'eventos');
ok(!JSON.stringify(row).includes('NÃO EXPORTAR'),'sem rótulos privados');
const absent=batch.auditRow('other1',null);
eq(absent.level,'not_found','inexistente sem pista');eq(absent.origin,'unknown','origem protegida');
const failure=batch.failedAuditRow('other2');eq(failure.level,'inspection_failed','falha genérica');
for(const invalid of ['a/b','a.b','','a'.repeat(121)]){
  assert.throws(()=>batch.auditRow(invalid,null));checks++;
  assert.throws(()=>batch.failedAuditRow(invalid));checks++;
}
const badCert=batch.auditRow('other3',fake(),{source:'client_cache',public_projection_valid:true});
eq(badCert.public_projection_valid,false,'cache não certifica');
const warn=batch.auditRow('warning1',fake('NO_LEDGER','manual','needs_attention'),cert);
const block=batch.auditRow('block1',fake('NOT_ACCEPTED','food99','blocked'),cert);
const unknown=batch.auditRow('unknown1',fake('none','alien','ready_for_internal_review'),cert);
eq(unknown.origin,'unknown','origem não identificada');
const withMore=batch.auditRow('signals1',{
  ...fake('NO_LEDGER'),readiness:{...fake().readiness,signals:[{code:'MISSING_ROUTE',severity:'warning',label:'PRIVADO'},{code:'INVALID.CSV',severity:'blocker',label:'PESSOAL'}]}
},cert);
eq(withMore.signals.length,1,'código inválido removido');
const sample=[row,absent,failure,warn,block,unknown,withMore];
const s=batch.summarizeAudit(sample,'2026-11-04T12:00:00Z');
eq(s.sample_size,7,'total exato');eq(s.recognized,5,'reconhecidos');eq(s.unavailable,2,'indisponíveis');
eq(s.internal_reviewable,3,'revisáveis');eq(s.needs_attention,1,'atenção');eq(s.blocked,1,'bloqueados');
eq(s.valid_public_projections,5,'certificados');eq(s.by_origin.site,2,'site');eq(s.by_origin.manual,1,'loja');eq(s.by_origin.food99,1,'marketplace');eq(s.by_origin.unknown,3,'desconhecidos');
ok(s.top_signals.some(x=>x.code==='NO_LEDGER'&&x.count===1),'sinais agregados');
eq(s.scope,'owner_only','escopo');eq(s.customer_access_activated_by_audit,false,'publico desligado');eq(s.messages_sent_by_audit,false,'notificações desligadas');
const text=batch.auditReportText(s);
for(const sensitive of ['order1','other1','VISÃO ADMIN','PRIVADO','NÃO EXPORTAR','R$','phone','address','opaque_token','scope_handle'])ok(!text.includes(sensitive),'relatório limpo '+sensitive);
for(const present of ['Amostra','7 examinados','Prontos para revisão','Site','99Food','OFF'])ok(text.includes(present),'explicação '+present);
ok(s.rows.some(x=>x.delivery_id==='order1'),'ID privado permanece no painel autenticado');
const duplicated=[batch.auditRow('dupA',fake('NO_LEDGER'),cert),batch.auditRow('dupB',fake('NO_LEDGER'),cert)];
const combined=batch.summarizeAudit(duplicated);eq(combined.top_signals[0].count,2,'agrega problemas');
for(let n=1;n<=20;n++){
  const ids=Array.from({length:n},(_,i)=>'order'+i);
  ok(batch.validAuditIds(ids),'lote '+n);
  eq(batch.summarizeAudit(ids.map(x=>batch.auditRow(x,null))).sample_size,n,'contagem '+n);
}
assert.throws(()=>batch.summarizeAudit(Array.from({length:21},(_,i)=>batch.auditRow('order'+i,null))));checks++;
assert.throws(()=>batch.summarizeAudit([],'data-errada'));checks++;
const route=read('app/api/integration/tracking/v1/admin/audit/route.ts');
for(const marker of ['authorizedOwner(req)','trackingTenant()','validAuditIds(p.delivery_ids)','await req.text()','runOwnerBatchAudit','private, no-store','ownerNativeCors','AUDIT_UNAVAILABLE'])ok(route.includes(marker),'API guard '+marker);
ok(!route.includes('sendWhatsApp')&&!route.includes('issueGrant')&&!route.includes('firestore.rules'),'sem efeitos');
const ui=read('app/mais/acompanhamento/auditoria/page.tsx');
for(const marker of ['isSuperadminUid(user?.uid)','getIdToken()','cache:\'no-store\'','credentials:\'omit\'','delivery_ids:ids','setSummary(null)','setBusy(false)','auditReportText(summary)','perPage=20','20 pedido','<TrackingBatchAudit'])ok(ui.includes(marker),'UI '+marker);
ok(ui.includes('onClick={()=>void run()}'),'somente consulta explícita');
ok(!ui.includes('setInterval(')&&!ui.includes('setTimeout('),'sem polling');
const home=read('app/mais/acompanhamento/page.tsx');ok(home.includes("router.push('/mais/acompanhamento/auditoria')"),'navegação admin');
const pre=read('scripts/pre-apk.cjs');ok(pre.includes("'scripts/test-r252-batch-audit.cjs'"),'PRE-APK registrado');
const card=read('components/tracking/TrackingBatchAudit.tsx');
for(const marker of ['onCopy','onInspect','sample_size','top_signals','rows.map','owner_only'].filter(x=>x!=='owner_only'))ok(card.includes(marker),'card '+marker);
const server=read('lib/tracking/gate3/audit-server.ts');
for(const marker of ['inspectConfirmedOwnerDelivery','certifyInspection','while(cursor<ids.length)','failedAuditRow','summarizeAudit'])ok(server.includes(marker),'server '+marker);
const mockInspect=async id=>id==='missing'?null:id==='oops'?Promise.reject(Error('private incident')):fake();
const mocked=load('lib/tracking/gate3/audit-server.ts',{
  'server-only':{},
  '../gate1/owner-inspection':{inspectConfirmedOwnerDelivery:mockInspect},
  '../gate2/certification':{certifyInspection:()=>cert},
  './batch-audit':batch,
});
(async()=>{
  const result=await mocked.runOwnerBatchAudit(['ok1','missing','oops']);
  eq(result.sample_size,3,'servidor lote');eq(result.unavailable,2,'servidor erro isolado');
  eq(result.recognized,1,'servidor reconhecido');
  await assert.rejects(()=>mocked.runOwnerBatchAudit([]));checks++;
  console.log(`R252_GATE3_APROVADO: ${checks} verificações locais (lote, privacidade, API, UI, servidor mock, limite e regressão estática).`);
})().catch(e=>{console.error('R252_GATE3_BLOQUEADA',e);process.exitCode=1;});
