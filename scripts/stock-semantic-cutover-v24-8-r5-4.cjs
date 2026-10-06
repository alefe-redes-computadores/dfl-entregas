const fs=require('fs'),crypto=require('crypto');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
const db=getFirestore();
const E=process.env;
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const n=v=>Number(v??0);
const pid=x=>String(x.product_id??x.productId??x.stock_product_id??x.stockProductId??'');
const q=x=>n(x.quantity??x.quantidade??x.amount);
const dt=x=>String(x.created_at??x.createdAt??x.date??x.data??'');

const SPEC=[
 {id:'catalog-ketchup-sache',name:'Ketchup sachê',factor:156,
  cutoverEntry:{quantity:624,date:'2026-10-01T19:02:15.531Z'},
  expected:{unit:'pct',current:156,average_cost:0.08},
  target:{unit:'un'}},
 {id:'catalog-sacola-38x48',name:'Sacola plástica 38 × 48',factor:100,
  cutoverEntry:{quantity:100,date:'2026-10-03T17:17:26.100Z'},
  expected:{unit:'pct',current:100,average_cost:0.115},
  target:{unit:'un'}}
];

async function firstCollection(names){
 for(const name of names){const s=await db.collection(name).limit(1).get();if(!s.empty)return name}
 throw Error(`Coleção não encontrada: ${names.join('/')}`);
}
(async()=>{
 const pc=await firstCollection(['stock_products','stockProducts']);
 const mc=await firstCollection(['stock_movements','stockMovements']);
 const mSnap=await db.collection(mc).get();
 const allMovs=mSnap.docs.map(d=>({id:d.id,...d.data()}));
 const rows=[];

 for(const s of SPEC){
  const ref=db.collection(pc).doc(s.id), snap=await ref.get();
  if(!snap.exists)throw Error(`Produto ausente: ${s.id}`);
  const p=snap.data(), pm=allMovs.filter(x=>pid(x)===s.id).sort((a,b)=>dt(a).localeCompare(dt(b)));
  const cut=pm.find(x=>Math.abs(q(x)-s.cutoverEntry.quantity)<1e-9 && dt(x)===s.cutoverEntry.date);
  const idx=cut?pm.findIndex(x=>x.id===cut.id):-1;
  const before=idx>=0?pm.slice(0,idx):pm, after=idx>=0?pm.slice(idx):[];
  const presentation=(p.presentations||[]).find(x=>Number(x?.conversion_quantity)===s.factor);
  const already=p.unit==='un';
  const checks={
   cutover_entry_found:!!cut,
   pre_cutover_ends_at_zero: before.length>0 && n(before[before.length-1].balance_after??before[before.length-1].balance)===0,
   post_cutover_quantities_physical: after.length>0 && after.every(x=>Math.abs(q(x)-Math.round(q(x)))<1e-9),
   current_matches:s.id.includes('ketchup')?n(p.current_quantity)===156:n(p.current_quantity)===100,
   presentation_factor_matches:Number(presentation?.conversion_quantity)===s.factor,
   presentation_purchase_unit_physical_package:['cx','pct'].includes(String(presentation?.purchase_unit||'')),
   current_unit_expected:p.unit===s.expected.unit || already
  };
  const safe=Object.values(checks).every(Boolean);
  rows.push({
   ...s,collection:pc,document_hash:hash(p),already_converged:already,safe,
   current:{unit:p.unit,current_quantity:p.current_quantity,minimum_quantity:p.minimum_quantity??null,ideal_quantity:p.ideal_quantity??null,average_cost:p.average_cost??null,presentations:p.presentations??[]},
   checks,cutover:{movement_id:cut?.id??null,date:s.cutoverEntry.date,entry_quantity:s.cutoverEntry.quantity,
     pre_count:before.length,post_count:after.length,
     pre_last_balance:before.length?n(before.at(-1).balance_after??before.at(-1).balance):null},
   proposed_write: safe&&!already ? {unit:'un'} : null,
   immutable:['current_quantity','minimum_quantity','ideal_quantity','average_cost','presentations','stock_movements','stock_supplies']
  });
 }
 const report={generated_at:new Date().toISOString(),mode:E.R54_MODE,project:'dfl-painel',writes_executed:0,rows};
 fs.writeFileSync(E.R54_PLAN,JSON.stringify(report,null,2));
 let txt=`DFL V24.8 R5.4 — SEMANTIC CUTOVER ${E.R54_MODE}\nWrites planejados: ${rows.filter(x=>x.proposed_write).length}\n`;
 for(const x of rows){
  txt+=`\n${x.name} (${x.id})\n`;
  txt+=`  atual: base=${x.current.unit} saldo=${x.current.current_quantity} mínimo=${x.current.minimum_quantity} meta=${x.current.ideal_quantity} custo=${x.current.average_cost}\n`;
  txt+=`  corte: ${x.cutover.date} entrada=${x.cutover.entry_quantity}; saldo imediatamente anterior=${x.cutover.pre_last_balance}\n`;
  txt+=`  checks: ${Object.entries(x.checks).map(([k,v])=>`${k}=${v?'OK':'FALHA'}`).join(' | ')}\n`;
  txt+=`  decisão: ${x.already_converged?'ALREADY_CONVERGED':x.safe?'RELABEL_ONLY pct -> un; fator 1; histórico intacto':'BLOCKED'}\n`;
 }
 fs.writeFileSync(E.R54_TXT,txt);
 console.log(txt);

 if(E.R54_MODE!=='APPLY'){console.log('\nDRY-RUN: zero writes.');return;}
 const todo=rows.filter(x=>x.proposed_write);
 if(!todo.length){console.log('\nAPPLY idempotente: nada a alterar.');return;}
 if(rows.some(x=>!x.safe))throw Error('APPLY BLOQUEADO: pelo menos um caso não provou o corte semântico.');

 const docs=[];
 for(const x of todo){const s=await db.collection(pc).doc(x.id).get();docs.push({id:x.id,hash:hash(s.data()),data:s.data()});}
 fs.writeFileSync(E.R54_SNAP,JSON.stringify({generated_at:new Date().toISOString(),documents:docs},null,2));

 let writes=0;
 for(const x of todo){
  const ref=db.collection(pc).doc(x.id);
  await db.runTransaction(async tx=>{
   const fresh=await tx.get(ref);
   if(hash(fresh.data())!==x.document_hash)throw Error(`PRECONDITION falhou: ${x.name} mudou durante a operação`);
   tx.update(ref,{unit:'un'});
  });
  writes++;
 }
 report.writes_executed=writes;
 fs.writeFileSync(E.R54_PLAN,JSON.stringify(report,null,2));

 const audit=[];
 for(const x of rows){
  const s=await db.collection(pc).doc(x.id).get(),p=s.data();
  audit.push({
   id:x.id,name:x.name,unit:p.unit,
   unit_ok:p.unit==='un',
   current_unchanged:p.current_quantity===x.current.current_quantity,
   minimum_unchanged:(p.minimum_quantity??null)===x.current.minimum_quantity,
   ideal_unchanged:(p.ideal_quantity??null)===x.current.ideal_quantity,
   average_cost_unchanged:(p.average_cost??null)===x.current.average_cost,
   presentations_unchanged:JSON.stringify(p.presentations??[])===JSON.stringify(x.current.presentations)
  });
 }
 fs.writeFileSync(E.R54_POST,JSON.stringify({generated_at:new Date().toISOString(),writes,audit},null,2));
 if(audit.some(x=>!x.unit_ok||!x.current_unchanged||!x.minimum_unchanged||!x.ideal_unchanged||!x.average_cost_unchanged||!x.presentations_unchanged))
  throw Error('Pós-auditoria falhou.');
 console.log(`\nAPPLY OK: ${writes} relabel(s). Histórico e valores quantitativos intactos.`);
})().catch(e=>{console.error(e);process.exit(1)});
