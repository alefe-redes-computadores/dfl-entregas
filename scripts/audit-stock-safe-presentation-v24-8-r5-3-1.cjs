const fs=require('fs');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
const db=getFirestore();

const targets=[
 {id:'catalog-detergente-500ml',name:'Detergente 500 ml',label:'Fardo - 6 un',expected:'fardo',factor:6},
 {id:'stock-1789058805887',name:'Hambúrguer 56g',label:'Caixa - 36 un',expected:'cx',factor:36},
 {id:'stock-1790443008324-xgpwj',name:'Papel Acoplado Metalizado [200 un]',label:'Pacote 200 un',expected:'pct',factor:200},
 {id:'stock-1790452114337-h10i4',name:'Copo descartáveis 50ml [100 un]',label:'Pacote 100 un',expected:'pct',factor:100},
 {id:'stock-1790452409388-8qhtz',name:'Copo descartáveis 50ml [100 un[',label:'Pacote com 100',expected:'pct',factor:100},
];

(async()=>{
 let collection=null;
 for(const c of ['stock_products','stockProducts']){
   const s=await db.collection(c).limit(1).get();
   if(!s.empty){collection=c;break;}
 }
 if(!collection)throw Error('Coleção de estoque não encontrada.');

 const rows=[];
 for(const t of targets){
   const s=await db.collection(collection).doc(t.id).get();
   if(!s.exists){rows.push({...t,state:'MISSING'});continue;}
   const p=s.data();
   const presentations=Array.isArray(p.presentations)?p.presentations:[];
   const matches=presentations.filter(x=>x && (x.label===t.label || Number(x.conversion_quantity)===t.factor));
   const exact=matches.find(x=>Number(x.conversion_quantity)===t.factor);
   let state='DIVERGED';
   if(exact?.purchase_unit===t.expected)state='ALREADY_CONVERGED';
   else if(exact?.purchase_unit==='un')state='STILL_PENDING';
   rows.push({
     ...t,state,
     current:{
       unit:p.unit??null,current_quantity:p.current_quantity??null,
       minimum_quantity:p.minimum_quantity??null,ideal_quantity:p.ideal_quantity??null,
       average_cost:p.average_cost??null,
       matched_presentations:matches.map(x=>({id:x.id??null,label:x.label??null,purchase_unit:x.purchase_unit??null,conversion_quantity:x.conversion_quantity??null,active:x.active??null}))
     }
   });
 }
 const summary=rows.reduce((a,x)=>(a[x.state]=(a[x.state]||0)+1,a),{});
 const report={generated_at:new Date().toISOString(),mode:'READ_ONLY',writes:0,collection,summary,rows};
 fs.writeFileSync(process.env.R531_JSON,JSON.stringify(report,null,2));

 let txt=`DFL V24.8 R5.3.1 — POST-MORTEM READ-ONLY\nColeção: ${collection}\nWrites: 0\n\n`;
 txt+=Object.entries(summary).map(([k,v])=>`${k}: ${v}`).join('\n')+'\n';
 for(const x of rows){
   txt+=`\n[${x.state}] ${x.name} (${x.id})\n`;
   if(x.current){
     txt+=`  base=${x.current.unit} saldo=${x.current.current_quantity} mínimo=${x.current.minimum_quantity} meta=${x.current.ideal_quantity} custo=${x.current.average_cost}\n`;
     for(const pr of x.current.matched_presentations)
       txt+=`  apresentação: ${pr.label} = ${pr.purchase_unit}×${pr.conversion_quantity} active=${pr.active}\n`;
   }
   txt+=`  esperado: ${x.expected}×${x.factor}\n`;
 }
 fs.writeFileSync(process.env.R531_OUT,txt);
 console.log(txt);
})().catch(e=>{console.error(e);process.exit(1)});
