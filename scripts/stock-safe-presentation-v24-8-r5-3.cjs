const fs=require('fs'),crypto=require('crypto');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
const db=getFirestore();

const MODE=process.env.R53_MODE, PLAN=process.env.R53_PLAN, TXT=process.env.R53_TXT, SNAP=process.env.R53_SNAP, POST=process.env.R53_POST;
const stable=o=>JSON.stringify(o,Object.keys(o||{}).sort());
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

function commercialUnit(label){
 const s=norm(label);
 if(/\bfardo\b/.test(s))return'fardo';
 if(/\bcaixa\b|\bcx\b/.test(s))return'cx';
 if(/\bpacote\b|\bpct\b/.test(s))return'pct';
 return null;
}
function fixesFor(p){
 if(String(p.unit||'')!=='un'||!Array.isArray(p.presentations))return[];
 return p.presentations.flatMap((x,i)=>{
  if(!x||x.active===false)return[];
  const f=Number(x.conversion_quantity||0), before=String(x.purchase_unit||'');
  if(!(f>1)||before!=='un')return[];
  const target=commercialUnit(x.label);
  if(!target)return[];
  return [{index:i,id:x.id??null,label:x.label??'',before,after:target,factor:f}];
 });
}
async function loadProducts(){
 for(const name of ['stockProducts','stock_products']){
  const s=await db.collection(name).get();
  if(!s.empty)return{name,docs:s.docs};
 }
 return{name:'stockProducts',docs:[]};
}
(async()=>{
 const {name:collection,docs}=await loadProducts();
 const candidates=[];
 for(const d of docs){
  const p=d.data(), fixes=fixesFor(p);
  if(!fixes.length)continue;
  const before={
   unit:p.unit,current_quantity:p.current_quantity??null,minimum_quantity:p.minimum_quantity??null,
   ideal_quantity:p.ideal_quantity??null,average_cost:p.average_cost??null,presentations:p.presentations
  };
  const next=p.presentations.map(x=>({...x}));
  for(const f of fixes)next[f.index]={...next[f.index],purchase_unit:f.after};
  const after={...before,presentations:next};
  candidates.push({
   collection,id:d.id,name:p.name||d.id,update_time:d.updateTime?.toDate?.().toISOString?.()||null,
   document_hash:hash(p),fixes,before,after,
   invariants:{
    unit_unchanged:before.unit===after.unit,
    current_unchanged:before.current_quantity===after.current_quantity,
    minimum_unchanged:before.minimum_quantity===after.minimum_quantity,
    ideal_unchanged:before.ideal_quantity===after.ideal_quantity,
    average_cost_unchanged:before.average_cost===after.average_cost
   }
  });
 }
 const plan={generated_at:new Date().toISOString(),mode:MODE,project:'dfl-painel',collection,candidate_count:candidates.length,candidates,writes_executed:0};
 fs.writeFileSync(PLAN,JSON.stringify(plan,null,2));
 fs.writeFileSync(TXT,[
  `DFL V24.8 R5.3 — SAFE PRESENTATION ${MODE}`,
  `Coleção: ${collection}`,
  `Candidatos: ${candidates.length}`,
  ...candidates.flatMap(c=>[
   `\n${c.name} (${c.id})`,
   ...c.fixes.map(f=>`  ${f.label}: ${f.before}×${f.factor} -> ${f.after}×${f.factor}`),
   `  saldo=${c.before.current_quantity} mínimo=${c.before.minimum_quantity} meta=${c.before.ideal_quantity} custo=${c.before.average_cost}`
  ])
 ].join('\n'));

 if(MODE!=='APPLY'){console.log(fs.readFileSync(TXT,'utf8'));console.log('\nDRY-RUN: zero writes.');return;}

 if(!candidates.length)throw Error('APPLY abortado: nenhum candidato seguro.');
 // Snapshot integral dos documentos que serão tocados.
 fs.writeFileSync(SNAP,JSON.stringify({
  generated_at:new Date().toISOString(),project:'dfl-painel',collection,
  documents:candidates.map(c=>({id:c.id,name:c.name,document_hash:c.document_hash,data:docs.find(d=>d.id===c.id).data()}))
 },null,2));

 let writes=0;
 for(const c of candidates){
  const ref=db.collection(c.collection).doc(c.id);
  await db.runTransaction(async tx=>{
   const fresh=await tx.get(ref);
   if(!fresh.exists)throw Error(`Documento sumiu: ${c.id}`);
   const data=fresh.data();
   if(hash(data)!==c.document_hash)throw Error(`PRECONDITION falhou: ${c.name} mudou desde o dry-plan desta execução`);
   // Defesa dupla: somente presentations.
   tx.update(ref,{presentations:c.after.presentations});
  });
  writes++;
 }
 plan.writes_executed=writes;
 fs.writeFileSync(PLAN,JSON.stringify(plan,null,2));

 // Pós-auditoria: prova dos invariantes.
 const audit=[];
 for(const c of candidates){
  const s=await db.collection(c.collection).doc(c.id).get(), p=s.data();
  audit.push({
   id:c.id,name:c.name,
   presentations_ok:JSON.stringify(p.presentations)===JSON.stringify(c.after.presentations),
   unit_unchanged:p.unit===c.before.unit,
   current_unchanged:(p.current_quantity??null)===c.before.current_quantity,
   minimum_unchanged:(p.minimum_quantity??null)===c.before.minimum_quantity,
   ideal_unchanged:(p.ideal_quantity??null)===c.before.ideal_quantity,
   average_cost_unchanged:(p.average_cost??null)===c.before.average_cost
  });
 }
 fs.writeFileSync(POST,JSON.stringify({generated_at:new Date().toISOString(),writes,audit},null,2));
 if(audit.some(x=>!x.presentations_ok||!x.unit_unchanged||!x.current_unchanged||!x.minimum_unchanged||!x.ideal_unchanged||!x.average_cost_unchanged))
   throw Error('Pós-auditoria detectou quebra de invariantes.');
 console.log(`APPLY OK: ${writes} produto(s), somente presentations.`);
 console.log(`Snapshot: ${SNAP}\nPós-auditoria: ${POST}`);
})().catch(e=>{console.error(e);process.exit(1)});
