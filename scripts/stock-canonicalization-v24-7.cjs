'use strict';
const fs=require('fs'), path=require('path');
const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const APPLY=process.argv.includes('--apply');
const RESTORE=process.argv.includes('--restore');
const restoreArg=process.argv.find(x=>x.startsWith('--restore='));
const key=process.env.GOOGLE_APPLICATION_CREDENTIALS;
if(!key||!fs.existsSync(key)) throw new Error('Defina GOOGLE_APPLICATION_CREDENTIALS para a Service Account local.');
if(!getApps().length) initializeApp({credential:cert(require(key))});
const db=getFirestore();
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const round=n=>Math.abs(n)<1e-9?0:Number(Number(n).toFixed(6));
/* V24.7-R4.1 PRESENTATION EQUIVALENCE */
const presentationSemanticKey=p=>{
 const t=norm(p?.label);
 const nums=t.match(/\d+(?:[.,]\d+)?/g)||[];
 const first=nums.length?Number(nums[0].replace(',','.')):null;
 if(/fardo/.test(t)) return 'fardo:'+(Number.isFinite(first)?first:'');
 if(/300\s*g/.test(t)) return 'peso:300g';
 if(/2\s*l/.test(t)&&/(frasco|garrafa)/.test(t)) return 'volume:2l';
 return t;
};
const samePresentation=(a,b)=>a?.id===b?.id || presentationSemanticKey(a)===presentationSemanticKey(b);
const assertPresentationConsistency=(name,arr)=>{
 const seen=new Map();
 for(const p of arr||[]){
   const k=presentationSemanticKey(p);
   if(!k)continue;
   if(seen.has(k) && Number(seen.get(k).conversion_quantity)!==Number(p.conversion_quantity))
     throw new Error('V24.7 R4.1: apresentações equivalentes conflitantes em '+name+' ['+k+']');
   if(!seen.has(k))seen.set(k,p);
 }
};

const clone=x=>JSON.parse(JSON.stringify(x));
const now=()=>new Date().toISOString();
const backupDir=path.join(process.env.HOME,'storage/downloads/dfl-entregas-backups');
async function load(col){const s=await db.collection(col).get(); return s.docs.map(d=>({id:d.id,...d.data()}));}
async function main(){
 const [products,movements,supplies]=await Promise.all([load('stock_products'),load('stock_movements'),load('stock_supplies')]);
 const byPid=new Map(); for(const m of movements){const a=byPid.get(m.product_id)||[];a.push(m);byPid.set(m.product_id,a)}
 const linked=new Map(); for(const s of supplies) for(const i of s.items||[]) if(i.stock_product_id){const a=linked.get(i.stock_product_id)||[];a.push({supply:s,item:i});linked.set(i.stock_product_id,a)}
 const plan=[]; const review=[];
 // V24.7-R4.2 MIGRATION SAFETY GATE
 const add=(kind,p,patch,extra={})=>plan.push({kind,id:p.id,name:p.name,before:clone(p),patch,...extra});
 // Precisão: saneia apenas ruído numérico, sem apagar saldo material.
 for(const p of products){const q=Number(p.current_quantity); if(Number.isFinite(q)){const rq=round(q); if(rq!==q && (Math.abs(q-rq)<1e-9 || Math.abs(q)<1e-9)) add('precision',p,{current_quantity:rq});}}
 // Nome malformado comprovado; não toca em quantidade/histórico.
 for(const p of products){
  if(norm(p.name)!=='copo descartaveis 50ml 100 un' || !/\[$/.test(String(p.name))) continue;
  const hasHistory=(byPid.get(p.id)||[]).length>0 || (linked.get(p.id)||[]).length>0;
  const targetExists=products.some(x=>x.id!==p.id && norm(x.name)==='copo descartaveis 50ml 100 un');
  if(hasHistory && targetExists) review.push({id:p.id,name:p.name,unit:p.unit,current_quantity:p.current_quantity,movements:(byPid.get(p.id)||[]).length,reason:'rename criaria duplicado histórico indistinguível — preservado'});
  else add('name',p,{name:'Copo descartáveis 50ml [100 un]'});
}
 // Correções de apresentações somente quando a unidade-base já é semanticamente compatível.
 const presentationFixes=[
  [/fanta.*1\s*l/i,'un','fardo-12','Fardo com 12',12,'fardo'],
  [/coca.*lata.*310/i,'un','fardo-6','Fardo com 6',6,'fardo'],
  [/coca.*zero.*1\s*l/i,'un','fardo-6','Fardo com 6',6,'fardo'],
  [/kuat.*2\s*l/i,'un','fardo-6','Fardo com 6',6,'fardo'],
  [/tempero.*completo/i,'kg','pote-300g','Pote 300 g',0.3,'pct'],
 ];
 for(const p of products.filter(x=>x.active!==false)) for(const [re,unit,id,label,conv,pu] of presentationFixes){
   if(!re.test(p.name)||p.unit!==unit) continue;
   const arr=clone(p.presentations||[]); const desired={id,label,conversion_quantity:conv,purchase_unit:pu,active:true}; const idx=arr.findIndex(x=>samePresentation(x,desired));
   if(idx>=0){const x=arr[idx]; if(Number(x.conversion_quantity)!==conv||x.purchase_unit!==pu||x.label!==label){arr[idx]={...x,label,conversion_quantity:conv,purchase_unit:pu,active:true};assertPresentationConsistency(p.name,arr);add('presentation',p,{presentations:arr});}}
   else {arr.push(desired);assertPresentationConsistency(p.name,arr);add('presentation',p,{presentations:arr});}
 }
 // Água sanitária: só corrige se o rótulo declarar explicitamente 2 L.
 for(const p of products.filter(x=>x.active!==false && /agua sanitaria/i.test(norm(x.name)) && x.unit==='l')){
   const arr=clone(p.presentations||[]); let changed=false;
   for(let i=0;i<arr.length;i++) if(/2\s*l/i.test(arr[i].label||'') && Number(arr[i].conversion_quantity)!==2){arr[i]={...arr[i],conversion_quantity:2};changed=true}
   if(changed){assertPresentationConsistency(p.name,arr);add('presentation',p,{presentations:arr});}
 }
 // Esponja: migração determinística conhecida: 1 pct legado = pacote com 4 unidades.
 // Multiplica contrato quantitativo inteiro: produto + movimentos + itens-base de compras vinculadas.
 for(const p of products.filter(x=>x.active!==false && /esponja.*louca/i.test(norm(x.name)))){
   if(p.unit==='pct'){
     const ms=byPid.get(p.id)||[], ls=linked.get(p.id)||[];
     const factor=4;
     add('unit-migration',p,{unit:'un',current_quantity:round(Number(p.current_quantity)*factor),minimum_quantity:round(Number(p.minimum_quantity)*factor),ideal_quantity:p.ideal_quantity==null?undefined:round(Number(p.ideal_quantity)*factor),presentations:[{id:'un',label:'Unidade',purchase_unit:'un',conversion_quantity:1,active:true},{id:'pct-4',label:'Pacote com 4',purchase_unit:'pct',conversion_quantity:4,active:true}]},{factor,movementIds:ms.map(x=>x.id),supplyIds:[...new Set(ls.map(x=>x.supply.id))]});
   }
 }
 // Casos ambíguos: relatório obrigatório, zero escrita automática.
 for(const p of products.filter(x=>x.active!==false)){
   if((/file.*frango/i.test(norm(p.name))&&p.unit!=='kg') || (/ovos/i.test(norm(p.name))&&p.unit!=='un') || (/pimenta.*bode/i.test(norm(p.name))&&!['kg','g'].includes(p.unit)) || (/batata.*palha/i.test(norm(p.name))&&p.unit!=='kg')) review.push({id:p.id,name:p.name,unit:p.unit,current_quantity:p.current_quantity,movements:(byPid.get(p.id)||[]).length,reason:'unidade histórica ambígua — revisão humana preservada'});
 }
 // Duplicados: somente candidatos sem saldo e sem movimento podem ser removidos automaticamente.
 const groups=new Map(); for(const p of products){const k=norm(p.name);const a=groups.get(k)||[];a.push(p);groups.set(k,a)}
 for(const [k,g] of groups) if(k&&g.length>1){for(const p of g){const mc=(byPid.get(p.id)||[]).length,sc=(linked.get(p.id)||[]).length,q=Number(p.current_quantity||0);if(p.active===false&&mc===0&&sc===0&&Math.abs(q)<1e-9) plan.push({kind:'safe-duplicate-delete',id:p.id,name:p.name,before:clone(p),patch:null}); else review.push({id:p.id,name:p.name,unit:p.unit,current_quantity:p.current_quantity,movements:mc,reason:'duplicado com estado/histórico/vínculo — preservado'});}}
 // Colapsa patches múltiplos do mesmo produto, exceto delete/unit migration.
 const writeBlockingReview=review.filter(x=>
  String(x.reason||'').startsWith('unidade histórica ambígua') ||
  String(x.reason||'').startsWith('rename criaria duplicado histórico indistinguível')
 );
 const reviewIds=new Set(writeBlockingReview.map(x=>x.id));
 const writablePlan=plan.filter(op=>!reviewIds.has(op.id));
 const blockedOps=plan.filter(op=>reviewIds.has(op.id));
 if(blockedOps.length) console.log('R4.2.3: operações bloqueadas por safety review:',blockedOps.map(x=>x.name+' ['+x.id+']').join(', '));
 const merged=[]; const ix=new Map(); for(const op of writablePlan){if(op.kind==='safe-duplicate-delete'||op.kind==='unit-migration'){merged.push(op);continue} const key=op.id; if(ix.has(key)){Object.assign(merged[ix.get(key)].patch,op.patch);merged[ix.get(key)].kind+='+'+op.kind}else{ix.set(key,merged.length);merged.push(op)}}
 for(const op of merged) if(op.patch?.presentations) assertPresentationConsistency(op.name,op.patch.presentations);
 const report={version:'V24.7-R4.2',generated_at:now(),mode:APPLY?'apply':'dry-run',counts:{products:products.length,movements:movements.length,supplies:supplies.length,operations:merged.length,review:review.length},operations:merged.map(({before,...x})=>({...x,before:{unit:before.unit,current_quantity:before.current_quantity,minimum_quantity:before.minimum_quantity,ideal_quantity:before.ideal_quantity,presentations:before.presentations,name:before.name}})),review};
 const reportPath=path.join(process.env.HOME,'storage/downloads',`dfl-stock-v24-7-plan-${Date.now()}.json`);fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.counts,null,2)); console.log('Plano:',reportPath); console.log('\nREVISÃO MANUAL PRESERVADA:'); review.forEach(x=>console.log('-',x.name,`[${x.id}]`,x.reason));
 if(!APPLY){console.log('\nDRY-RUN: nenhuma escrita realizada.');return}
 const stamp=Date.now(), backup={version:'V24.7-R4.2',created_at:now(),products:[],movements:[],supplies:[]};
 const pmap=new Map(products.map(x=>[x.id,x])), mmap=new Map(movements.map(x=>[x.id,x])), smap=new Map(supplies.map(x=>[x.id,x]));
 for(const op of merged){if(pmap.has(op.id))backup.products.push(pmap.get(op.id)); if(op.kind==='unit-migration'){for(const id of op.movementIds||[])if(mmap.has(id))backup.movements.push(mmap.get(id));for(const id of op.supplyIds||[])if(smap.has(id))backup.supplies.push(smap.get(id));}}
 const backupPath=path.join(backupDir,`v24-7-firestore-${stamp}.json`);fs.mkdirSync(backupDir,{recursive:true});fs.writeFileSync(backupPath,JSON.stringify(backup,null,2)); console.log('Backup Firestore:',backupPath);
 let batch=db.batch(),writes=0; const flush=async()=>{if(writes){await batch.commit();batch=db.batch();writes=0}}; const put=(ref,data)=>{batch.set(ref,data,{merge:true});if(++writes>=400)return flush()}; const del=ref=>{batch.delete(ref);if(++writes>=400)return flush()};
 for(const op of merged){
   if(op.kind==='safe-duplicate-delete'){await del(db.collection('stock_products').doc(op.id));continue}
   if(op.kind==='unit-migration'){
     const f=op.factor; for(const id of op.movementIds||[]){const m=mmap.get(id);if(!m)continue;await put(db.collection('stock_movements').doc(id),{quantity:round(Number(m.quantity)*f),balance_before:round(Number(m.balance_before)*f),balance_after:round(Number(m.balance_after)*f),updated_at:now()});}
     for(const sid of op.supplyIds||[]){const s=smap.get(sid);if(!s)continue;const items=(s.items||[]).map(i=>i.stock_product_id===op.id?{...i,quantity:round(Number(i.quantity)*f),unit:'un'}:i);await put(db.collection('stock_supplies').doc(sid),{items,updated_at:now()});}
   }
   const patch=Object.fromEntries(Object.entries(op.patch||{}).filter(([,v])=>v!==undefined));await put(db.collection('stock_products').doc(op.id),{...patch,updated_at:now(),canonicalization_version:'v24.7-r4.2'});
 }
 await flush(); console.log('\nAPPLY concluído. Backup:',backupPath);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
