const fs=require('fs');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
if(!getApps().length) initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
const db=getFirestore();
const n=v=>Number(v??0);
const text=v=>String(v??'');
const pid=x=>text(x.product_id??x.productId??x.stock_product_id??x.stockProductId);
const qty=x=>n(x.quantity??x.quantidade??x.amount);
const date=x=>text(x.created_at??x.createdAt??x.date??x.data);
const balance=x=>x.balance_after??x.balance??x.saldo_apos??null;
const type=x=>text(x.type??x.movement_type??x.tipo).toLowerCase();

const TARGET_HINTS=[
 'ovo','filé','file','gás','gas','pimenta','hamburgueira','lacre',
 'papel acoplado','luva','saco hambúrguer','saco hamburguer',
 'sacola 30','copo descartáveis 200','copo descartaveis 200','milho'
];

async function pick(names){
 for(const c of names){const s=await db.collection(c).limit(1).get(); if(!s.empty)return c}
 throw Error('Coleção não encontrada: '+names.join('/'));
}
(async()=>{
 const pc=await pick(['stock_products','stockProducts']);
 const mc=await pick(['stock_movements','stockMovements']);
 let sc=null;
 for(const c of ['stock_supplies','stockSupplies']){
   const s=await db.collection(c).limit(1).get(); if(!s.empty){sc=c;break}
 }
 const [ps,ms,ss]=await Promise.all([
   db.collection(pc).get(), db.collection(mc).get(), sc?db.collection(sc).get():Promise.resolve({docs:[]})
 ]);
 const products=ps.docs.map(d=>({id:d.id,...d.data()}));
 const movements=ms.docs.map(d=>({id:d.id,...d.data()}));
 const supplies=ss.docs.map(d=>({id:d.id,...d.data()}));
 const selected=products.filter(p=>{
   const s=(text(p.name)+' '+text(p.nome)).toLowerCase();
   return TARGET_HINTS.some(h=>s.includes(h));
 });

 const rows=selected.map(p=>{
   const name=text(p.name||p.nome||p.id);
   const mov=movements.filter(x=>pid(x)===p.id).sort((a,b)=>date(a).localeCompare(date(b)));
   const sup=supplies.filter(x=>pid(x)===p.id).sort((a,b)=>date(a).localeCompare(date(b)));
   const outs=mov.filter(x=>/(saida|saída|out|consum)/.test(type(x)) || qty(x)<0);
   const ins=mov.filter(x=>/(entrada|in|compra)/.test(type(x)) || qty(x)>0 && !outs.includes(x));
   const frac=mov.filter(x=>Math.abs(Math.abs(qty(x))-Math.round(Math.abs(qty(x))))>1e-9);
   const pres=Array.isArray(p.presentations)?p.presentations:[];
   const factors=[...new Set(pres.map(x=>n(x?.conversion_quantity)).filter(x=>x>1))];
   const commercialBase=['pct','cx','fardo'].includes(text(p.unit));
   const physicalBase=['un','kg','g','l','ml'].includes(text(p.unit));
   const factorMismatch=pres.filter(x=>n(x?.conversion_quantity)>1 && text(x?.purchase_unit)===text(p.unit));
   let lane='REVIEW';
   const evidence=[];
   if(commercialBase){evidence.push('base_comercial');}
   if(physicalBase){evidence.push('base_fisica');}
   if(frac.length)evidence.push('historico_fracionado');
   if(factors.length)evidence.push('apresentacao_com_fator');
   if(factorMismatch.length)evidence.push('taxonomia_apresentacao_suspeita');

   // Classification is deliberately conservative: evidence only, never authorization to write.
   if(physicalBase && factorMismatch.length && !frac.length) lane='PRESENTATION_ONLY_CANDIDATE';
   else if(commercialBase && frac.length && factors.length) lane='SCALE_OR_RELABEL_FORENSIC';
   else if(commercialBase && !frac.length && factors.length) lane='RELABEL_OR_SCALE_FORENSIC';
   else if(physicalBase && frac.length) lane='UNIT_FORENSIC';

   return {
    id:p.id,name,active:p.active??null,unit:p.unit??null,
    current_quantity:p.current_quantity??null,minimum_quantity:p.minimum_quantity??null,
    ideal_quantity:p.ideal_quantity??null,average_cost:p.average_cost??null,
    lane,evidence,
    presentations:pres.map(x=>({id:x?.id??null,label:x?.label??null,purchase_unit:x?.purchase_unit??null,conversion_quantity:x?.conversion_quantity??null,active:x?.active??null})),
    stats:{movements:mov.length,entries:ins.length,exits:outs.length,fractional_movements:frac.length,supplies:sup.length},
    timeline:mov.map(x=>({id:x.id,date:date(x),type:type(x),quantity:qty(x),balance:balance(x)})),
    supply_snapshots:sup.map(x=>({id:x.id,date:date(x),quantity:x.quantity??x.quantidade??null,unit:x.unit??x.purchase_unit??null,total_cost:x.total_cost??x.total??x.cost??null,unit_cost:x.unit_cost??x.cost_per_unit??null})),
    decision:'READ_ONLY_REVIEW'
   };
 });

 const report={
  generated_at:new Date().toISOString(),mode:'READ_ONLY',writes:0,
  collections:{products:pc,movements:mc,supplies:sc},
  scanned:{products:products.length,movements:movements.length,supplies:supplies.length},
  selected:rows.length,
  lanes:rows.reduce((a,x)=>(a[x.lane]=(a[x.lane]||0)+1,a),{}),
  rows
 };
 fs.writeFileSync(process.env.R55_JSON,JSON.stringify(report,null,2));
 let out=`DFL V24.8 R5.5 — FORENSIC RESOLUTION READ-ONLY\nWrites: 0\nProdutos analisados: ${rows.length}\n\n`;
 out+=Object.entries(report.lanes).map(([k,v])=>`${k}: ${v}`).join('\n')+'\n';
 for(const x of rows){
  out+=`\n[${x.lane}] ${x.name} (${x.id})\n`;
  out+=`  base=${x.unit} saldo=${x.current_quantity} mínimo=${x.minimum_quantity} meta=${x.ideal_quantity} custo=${x.average_cost}\n`;
  out+=`  movimentos=${x.stats.movements} entradas=${x.stats.entries} saídas=${x.stats.exits} fracionados=${x.stats.fractional_movements} compras=${x.stats.supplies}\n`;
  out+=`  evidências: ${x.evidence.join(', ')||'nenhuma conclusiva'}\n`;
  if(x.presentations.length) out+=`  apresentações: ${x.presentations.map(p=>`${p.label}:${p.purchase_unit}×${p.conversion_quantity}`).join(' | ')}\n`;
  if(x.timeline.length) out+=`  timeline: ${x.timeline.map(m=>`${m.date} ${m.type||'?'} ${m.quantity}→${m.balance??'?'}`).join(' ; ')}\n`;
 }
 fs.writeFileSync(process.env.R55_TXT,out);
 console.log(out);
})().catch(e=>{console.error(e);process.exit(1)});
