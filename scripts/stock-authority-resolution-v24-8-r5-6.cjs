const fs=require('fs');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
const db=getFirestore();
const S=v=>String(v??'');
const N=v=>Number(v??0);
const norm=s=>S(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/\[[^\]]*\]|\([^)]*\)/g,' ').replace(/\b\d+\s*(un|ml|g|kg|l)\b/g,' ')
 .replace(/[^a-z0-9]+/g,' ').trim();
const pid=x=>S(x.product_id??x.productId??x.stock_product_id??x.stockProductId);
const dt=x=>S(x.created_at??x.createdAt??x.date??x.data);
async function pick(a){for(const c of a){let s=await db.collection(c).limit(1).get();if(!s.empty)return c}throw Error('coleção ausente')}
(async()=>{
 const pc=await pick(['stock_products','stockProducts']), mc=await pick(['stock_movements','stockMovements']);
 const [ps,ms]=await Promise.all([db.collection(pc).get(),db.collection(mc).get()]);
 const P=ps.docs.map(d=>({id:d.id,...d.data()})), M=ms.docs.map(d=>({id:d.id,...d.data()}));
 const focus=['file frango','gas','milho verde','pimenta bode','ovos brancos','hamburgueira th001','papel acoplado','lacre seguranca','luva descartavel'];
 const groups=[];
 for(const key of focus){
  const candidates=P.filter(p=>norm(p.name??p.nome).includes(key)||key.includes(norm(p.name??p.nome)));
  if(!candidates.length)continue;
  const rows=candidates.map(p=>{
   const mov=M.filter(x=>pid(x)===p.id).sort((a,b)=>dt(a).localeCompare(dt(b)));
   return {
    id:p.id,name:p.name??p.nome??p.id,active:p.active??null,unit:p.unit??null,
    current:p.current_quantity??null,min:p.minimum_quantity??null,ideal:p.ideal_quantity??null,cost:p.average_cost??null,
    presentations:(p.presentations??[]).map(x=>({label:x.label,purchase_unit:x.purchase_unit,conversion_quantity:x.conversion_quantity,active:x.active})),
    movement_count:mov.length,last_movement:mov.length?dt(mov.at(-1)):null,
    fractional_count:mov.filter(x=>Math.abs(Math.abs(N(x.quantity??x.quantidade??x.amount))-Math.round(Math.abs(N(x.quantity??x.quantidade??x.amount))))>1e-9).length
   };
  });
  const used=rows.filter(x=>x.movement_count>0);
  let authority='REVIEW',reason='ambiguous';
  if(used.length===1){authority=used[0].id;reason='único registro com histórico real';}
  else if(used.length>1){
    const sorted=[...used].sort((a,b)=>S(b.last_movement).localeCompare(S(a.last_movement)));
    if(sorted[0].last_movement!==sorted[1].last_movement){authority=sorted[0].id;reason='mais recente, mas requer revisão por múltiplos históricos';}
  } else {
    const active=rows.filter(x=>x.active!==false);
    if(active.length===1){authority=active[0].id;reason='sem histórico; único registro não inativo';}
  }
  groups.push({key,authority,reason,rows});
 }
 const r={generated_at:new Date().toISOString(),mode:'READ_ONLY',writes:0,groups};
 fs.writeFileSync(process.env.R56_JSON,JSON.stringify(r,null,2));
 let t=`DFL V24.8 R5.6 — AUTHORITY RESOLUTION READ-ONLY\nWrites: 0\nGrupos: ${groups.length}\n`;
 for(const g of groups){
  t+=`\n=== ${g.key} ===\nAutoridade sugerida: ${g.authority}\nMotivo: ${g.reason}\n`;
  for(const x of g.rows)t+=`  ${x.id} | ${x.name} | active=${x.active} | base=${x.unit} | saldo=${x.current} | custo=${x.cost} | mov=${x.movement_count} | frac=${x.fractional_count} | último=${x.last_movement}\n`;
 }
 fs.writeFileSync(process.env.R56_TXT,t); console.log(t);
})().catch(e=>{console.error(e);process.exit(1)});
