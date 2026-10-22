'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path');
const root=process.cwd();let checks=0;const check=(condition,message)=>{assert.ok(condition,message);checks++};
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
const input={proof:'lib/access/staffRefreshProof.ts',commit:'lib/access/staffRefreshCommit.ts',snapshot:'lib/access/staffRefreshSnapshot.ts',api:'app/api/access/refresh/route.ts',page:'app/mais/acessos/sincronizacao/page.tsx'};
for(const file of Object.values(input)){
 const diagnostics=ts.transpileModule(source(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).diagnostics||[];
 check(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length===0,'TS/JSX inválido: '+file);
}
const policyStub={sameProjectedValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),REFRESH_SECTIONS:['home','routes','deliveries','stock','purchases'],assessRefreshAccount:(uid,x)=>!x||x.uid!==uid||x.status!=='suspended'||x.role!=='motoboy'||!Array.isArray(x.permissions)||x.permissions.includes('stock_read')?['invalid']:[],compareRefreshSnapshot:(a,b)=>({totalNew:Object.values(b).reduce((n,list)=>n+list.length,0),totalChanges:Object.keys(b).reduce((n,k)=>{const x=new Map(a[k].map(y=>[y.id,JSON.stringify(y.value)]));const y=new Map(b[k].map(z=>[z.id,JSON.stringify(z.value)]));return n+[...x.keys()].filter(id=>!y.has(id)).length+[...y.keys()].filter(id=>x.get(id)!==y.get(id)).length;},0)})};
function load(file,mocks){const mod={exports:{}};const code=ts.transpileModule(source(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)((id)=>{if(id in mocks)return mocks[id];if(id==='node:crypto')return require('node:crypto');throw new Error('Import inesperado: '+id);},mod,mod.exports);return mod.exports;}
const proof=load(input.proof,{'./staffRefreshPolicy':policyStub});
const empty=()=>({home:[],routes:[],deliveries:[],stock:[],purchases:[]});
const initial=empty(),fresh=empty();fresh.routes=[{id:'route1',value:{title:'Rota A',subtitle:'Hoje',status:'Em andamento'}}];
const a=proof.staffRefreshProof('staff-000001','2026-10-20T20:00:00Z',initial,fresh);
check(/^[0-9a-f]{64}$/.test(a),'SHA256 válido');
const changed=empty();changed.routes=[{id:'route1',value:{status:'Em andamento',subtitle:'Hoje',title:'Rota A'}}];
check(a===proof.staffRefreshProof('staff-000001','2026-10-20T20:00:00Z',initial,changed),'Campos reordenados mantêm hash');
check(a!==proof.staffRefreshProof('staff-000001','2026-10-20T20:00:00Z',fresh,changed),'Mudança da projeção atual altera hash');
check(a!==proof.staffRefreshProof('staff-000002','2026-10-20T20:00:00Z',initial,fresh),'UID separa provas');
check(a!==proof.staffRefreshProof('staff-000001','2026-10-20T20:01:00Z',initial,fresh),'Versão altera prova');
const account={uid:'staff-000001',status:'suspended',role:'motoboy',permissions:['home','routes_read','deliveries_read'],linkedMotoboyId:'bike1',draftId:'draft-000001',updatedAt:'2026-10-20T20:00:00Z'};
const draft={status:'rascunho',activation:'not_enabled',role:'motoboy',email:'worker@example.invalid',permissions:['home','routes_read','deliveries_read'],linkedMotoboyId:'bike1'};
const draftFp=proof.staffDraftFingerprint(draft),accountFp=proof.staffAccountFingerprint(account);
check(draftFp!==proof.staffDraftFingerprint({...draft,permissions:['routes_read']}),'Alteração de permissão no rascunho detectada');
check(draftFp!==proof.staffDraftFingerprint({...draft,linkedMotoboyId:'bike2'}),'Alteração de vínculo no rascunho detectada');
check(accountFp!==proof.staffAccountFingerprint({...account,permissions:['home']}),'Permissões alteradas sem atualizar timestamp bloqueadas');
check(accountFp!==proof.staffAccountFingerprint({...account,status:'active'}),'Ativação simultânea bloqueada');
const makeDB=()=>{
 const store=new Map();const clone=x=>structuredClone(x);
 class Doc {constructor(p){this.path=p;this.id=p.split('/').at(-1);}collection(name){return new Collection(this.path+'/'+name);}get(){return Promise.resolve({id:this.id,exists:store.has(this.path),data:()=>clone(store.get(this.path))});}}
 class Query {constructor(p,filters=[],limit=9999){this.p=p;this.filters=filters;this.max=limit;}where(k,op,v){return new Query(this.p,[...this.filters,[k,op,v]],this.max);}limit(n){return new Query(this.p,this.filters,n);}get(){const prefix=this.p+'/';const docs=[...store].filter(([key])=>key.startsWith(prefix)&&key.slice(prefix.length).split('/').length===1).filter(([,data])=>this.filters.every(([k,op,v])=>op==='=='&&data[k]===v)).slice(0,this.max).map(([key,data])=>({id:key.split('/').at(-1),data:()=>clone(data)}));return Promise.resolve({size:docs.length,docs});}}
 let serial=0;class Collection extends Query {doc(id){return new Doc(this.p+'/'+(id||('generated-'+(++serial))));}}
 const db={collection:p=>new Collection(p),runTransaction:async cb=>{const writes=[];const tx={get:q=>q.get(),set:(ref,data)=>writes.push(['set',ref.path,clone(data)]),update:(ref,data)=>writes.push(['update',ref.path,clone(data)]),delete:ref=>writes.push(['delete',ref.path])};const result=await cb(tx);for(const [kind,p,data] of writes){if(kind==='delete')store.delete(p);else if(kind==='set')store.set(p,data);else store.set(p,{...store.get(p),...data});}return result;}};
 return {db,store};
};
const snapshotStub={buildFreshStaffSnapshot:async(db,live,reader)=>{
 const out=empty();const snap=await reader(db.collection('routes').where('motoboy_id','==',live.linkedMotoboyId).limit(30));out.routes=snap.docs.map(d=>({id:d.id,value:{title:d.data().name,subtitle:'Hoje',status:'Em andamento'}}));return out;
},readCurrentStaffSnapshot:async(db,uid,reader)=>{const out=empty();for(const section of policyStub.REFRESH_SECTIONS){const docs=await reader(db.collection('staff_workspaces').doc(uid).collection(section).limit(41));out[section]=docs.docs.map(d=>({id:d.id,value:d.data()}));}return out;}};
const commit=load(input.commit,{'./roles':{DFL_SUPERADMIN_UID:'OWNER-ONLY'},'./staffRefreshPolicy':policyStub,'./staffRefreshProof':proof,'./staffRefreshSnapshot':snapshotStub});
async function run(){
 const {db,store}=makeDB();store.set('staff_accounts/staff-000001',account);store.set('staff_access_drafts/draft-000001',draft);
 store.set('routes/route1',{name:'Rota A',motoboy_id:'bike1'});
 const build=async()=>{const old=await snapshotStub.readCurrentStaffSnapshot(db,account.uid,q=>q.get());const next=await snapshotStub.buildFreshStaffSnapshot(db,account,q=>q.get());return {uid:account.uid,expectedUpdatedAt:store.get('staff_accounts/staff-000001').updatedAt,expectedDigest:proof.staffRefreshProof(account.uid,store.get('staff_accounts/staff-000001').updatedAt,old,next),expectedDraftFingerprint:proof.staffDraftFingerprint(store.get('staff_access_drafts/draft-000001')),expectedAccountFingerprint:proof.staffAccountFingerprint(store.get('staff_accounts/staff-000001'))};};
 const req=await build();store.set('routes/route1',{name:'Mudou entre prévia e commit',motoboy_id:'bike1'});
 await assert.rejects(commit.commitSuspendedStaffRefresh(db,req),/R36_PREVIEW_STALE/);checks++;
 check(!store.has('staff_workspaces/staff-000001/routes/route1'),'Nada gravado após mudança de fonte');
 const good=await build();const first=await commit.commitSuspendedStaffRefresh(db,good);
 check(first.applied&&first.totalChanges===1,'Primeiro commit grava exatamente uma projeção');
 check(store.get('staff_workspaces/staff-000001/routes/route1').title==='Mudou entre prévia e commit','Conteúdo sincronizado da fonte');
 check(store.get('staff_accounts/staff-000001').status==='suspended','Conta permanece suspensa');
 check(!store.has('routes/route2'),'Origem não alterada');
 const auditKeys=()=>[...store.keys()].filter(k=>k.startsWith('staff_access_audit/'));
 const repeat=await build();const noop=await commit.commitSuspendedStaffRefresh(db,repeat);
 check(!noop.applied&&noop.totalChanges===0,'Sincronização repetida é no-op');
 check(auditKeys().length===1,'No-op não duplica evento de auditoria');
 const draftChanged=await build();store.set('staff_access_drafts/draft-000001',{...draft,linkedMotoboyId:'bike2'});
 await assert.rejects(commit.commitSuspendedStaffRefresh(db,draftChanged),/R36_DRAFT_CHANGED/);checks++;
 store.set('staff_access_drafts/draft-000001',draft);
 const accountChanged=await build();store.set('staff_accounts/staff-000001',{...store.get('staff_accounts/staff-000001'),permissions:['home']});
 await assert.rejects(commit.commitSuspendedStaffRefresh(db,accountChanged),/R36_ACCOUNT_CHANGED/);checks++;
 check(auditKeys().length===1,'Falhas não criam novos eventos');
}
// Ajuste equivalente ao .doc() automático do Firestore, para o modelo de transação.
// O mock acima gera identificadores dinâmicos no teste completo executado pelo emulador.
const api=source(input.api),ui=source(input.page),snapSource=source(input.snapshot),core=source(input.commit);
check(source('lib/access/staffRefreshClient.ts').includes('applied:boolean'),'Contrato do cliente reconhece no-op');
for(const part of ['verifiedAccount(uid)','staffRefreshProof(uid,account.updatedAt,before,next)','commitSuspendedStaffRefresh(adminDb','verifyIdToken(header.slice(7),true)','process.env.DFL_STAFF_PROJECTION_REFRESH_ENABLED'])check(api.includes(part),'API owner-only: '+part);
for(const part of ['await tx.get(accountRef)','await tx.get(db.collection(\'staff_access_drafts\')','buildFreshStaffSnapshot(db,account,read)','readCurrentStaffSnapshot(db,req.uid,read)','staffRefreshProof(req.uid','if(plan.totalChanges===0)','tx.update(accountRef','staff_access_audit'])check(core.includes(part),'Atomicidade: '+part);
check(core.indexOf('readCurrentStaffSnapshot(db,req.uid,read)')<core.indexOf('tx.update(accountRef'),'Todas leituras antes da escrita');
check(!/tx\.(?:set|update|delete)\(db\.collection\('(routes|deliveries|stock_products|stock_supplies|customers)'/.test(core),'Não escreve nos dados originais');
check(snapSource.includes('read:SafeQueryReader=standardRead')&&snapSource.includes('read(routes)')&&snapSource.includes('read(snap)'),'Consultas reutilizáveis na transação');
check(ui.includes('done.applied===false')&&ui.includes('Nenhuma mudança necessária'),'No-op visível com feedback premium');
check(!/setInterval|onSnapshot/.test(ui),'Sem polling');
check(source('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r36-refresh-atomicity.cjs'"),'Suite PRE-APK registrada');
run().then(()=>console.log(`R36: ${checks} verificações estáticas e de transação OK.`)).catch(e=>{console.error(e);process.exitCode=1;});
