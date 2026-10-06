const fs=require('fs');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
if(!getApps().length) initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
const db=getFirestore();

const O=process.env.R52_JSON,T=process.env.R52_TXT;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const n=v=>Number(v||0);
const r=(v,d=6)=>Number(n(v).toFixed(d));
const pid=x=>String(x.product_id??x.productId??x.stock_product_id??x.stockProductId??'');
const q=x=>n(x.quantity??x.quantidade??x.amount);
const date=x=>String(x.created_at??x.createdAt??x.date??x.data??'');
const typ=x=>norm(x.type??x.kind??x.movement_type??x.tipo);
const physical=new Set(['un','kg','g','l','ml']), commercial=new Set(['pct','cx','fardo']);

async function col(name){try{let s=await db.collection(name).get();return s.docs.map(d=>({id:d.id,...d.data()}))}catch{return[]}}
function presentationFixes(p){
 const unit=String(p.unit||'');
 return (Array.isArray(p.presentations)?p.presentations:[]).flatMap(x=>{
  if(!x||x.active===false)return[];
  const f=n(x.conversion_quantity), pu=String(x.purchase_unit||'');
  let to=null,why=null;
  if(unit==='un'&&pu==='un'&&f>1){to='pct';why='embalagem com múltiplas unidades físicas não deve usar un como unidade de compra';}
  if(!to)return[];
  return [{presentation_id:x.id,label:x.label,before:{purchase_unit:pu,conversion_quantity:f},after:{purchase_unit:to,conversion_quantity:f},why}];
 });
}
function timeline(movs){
 return [...movs].sort((a,b)=>date(a).localeCompare(date(b))).map(x=>({
  id:x.id,date:date(x),type:typ(x),quantity:r(q(x)),
  balance:r(x.balance_after??x.balance??0),
  supply_id:x.supply_id??x.supplyId??null
 }));
}
(async()=>{
 const cp=await col('stockProducts'), sp=await col('stock_products');
 const cm=await col('stockMovements'), sm=await col('stock_movements');
 const cs=await col('stockSupplies'), ss=await col('stock_supplies');
 const products=cp.length?cp:sp, movs=cm.length?cm:sm, supplies=cs.length?cs:ss;

 const plans=[];
 for(const p of products){
  const pm=movs.filter(x=>pid(x)===p.id), ps=supplies.filter(x=>pid(x)===p.id);
  const tl=timeline(pm);
  const fixes=presentationFixes(p);
  const unit=String(p.unit||''), name=String(p.name||'');
  const outs=tl.filter(x=>/(saida|out|consumo)/.test(x.type)&&!/(estorno|revers|correc|ajuste|contagem|saldo inicial)/.test(x.type)&&!x.supply_id);
  const frac=tl.filter(x=>Math.abs(x.quantity-Math.round(x.quantity))>1e-9);
  const factors=[...new Set((p.presentations||[]).map(x=>n(x?.conversion_quantity)).filter(x=>x>1))].sort((a,b)=>a-b);
  let lane='KEEP', status='NO_WRITE', targetUnit=null, factor=null, evidence=[], blockers=[];

  if(fixes.length){lane='SAFE_PRESENTATION';status='PROPOSED_SAFE';evidence.push('base física já é un; apenas taxonomia da forma de compra é inconsistente');}

  if(commercial.has(unit)){
   const looksPhysical=n(p.current_quantity)>10 && n(p.average_cost)>0 && n(p.average_cost)<2 && factors.length;
   if(looksPhysical){
    lane='RELABEL_FORENSIC';status='CANDIDATE_ONLY';targetUnit='un';factor=1;
    evidence.push('saldo/custo atuais parecem já estar em unidades físicas');
    if(frac.length) blockers.push('histórico contém quantidades fracionárias incompatíveis com relabel integral');
    if(outs.some(x=>x.quantity>=Math.max(...factors,2))) blockers.push('histórico contém saídas do tamanho de embalagem; provável mudança semântica temporal');
   } else if(/\b\d+\s*(un|und|unid)\b/i.test(name)||(p.presentations||[]).some(x=>n(x?.conversion_quantity)>1)){
    lane='SCALE_OR_RELABEL_FORENSIC';status='BLOCKED_REVIEW';
    evidence.push('produto comercial contém indicação de unidades físicas');
    blockers.push('não há prova suficiente para escolher SCALE_BASE ou RELABEL_ONLY');
   }
  }
  if(unit==='un'&&frac.length){
   lane='UNIT_FORENSIC';status='BLOCKED_REVIEW';
   blockers.push('base inteira possui movimentos fracionários');
  }

  if(lane==='KEEP')continue;

  // Detecta possíveis pontos de mudança de semântica sem reinterpretar o histórico.
  const semanticBreaks=[];
  for(let i=1;i<tl.length;i++){
   const a=tl[i-1],b=tl[i];
   if(factors.some(f=>f>1) && ((Math.abs(a.quantity)<2&&b.quantity>=factors[0])||(a.quantity>=factors[0]&&Math.abs(b.quantity)<2))){
    semanticBreaks.push({between:[a.id,b.id],dates:[a.date,b.date],reason:'salto de escala compatível com mudança de semântica'});
   }
  }

  const plan={
   product:{id:p.id,name,unit,current_quantity:r(p.current_quantity),minimum_quantity:r(p.minimum_quantity),ideal_quantity:r(p.ideal_quantity),average_cost:r(p.average_cost,4)},
   lane,status,target_unit:targetUnit,scale_factor:factor,
   presentation_fixes:fixes,evidence,blockers,
   semantic_break_candidates:semanticBreaks,
   timeline:tl,
   supplies:ps.map(x=>({id:x.id,date:date(x),quantity:r(q(x)),cost:r(x.total_cost??x.totalCost??x.cost??x.custo_total??x.price??x.preco,2),purchase_unit:x.purchase_unit??x.purchaseUnit??null,presentation_id:x.presentation_id??x.presentationId??null})),
   invariants:{
    current_quantity_before:r(p.current_quantity),
    minimum_quantity_before:r(p.minimum_quantity),
    ideal_quantity_before:r(p.ideal_quantity),
    average_cost_before:r(p.average_cost,4),
    history_mutations:0,
    supply_snapshot_mutations:0
   },
   proposed_write: status==='PROPOSED_SAFE'?{
     scope:'PRODUCT_PRESENTATIONS_ONLY',
     product_id:p.id,
     presentation_fixes:fixes,
     forbidden_fields:['current_quantity','minimum_quantity','ideal_quantity','average_cost','movements','supplies']
   }:null
  };
  plans.push(plan);
 }

 const counts=plans.reduce((a,x)=>(a[x.lane]=(a[x.lane]||0)+1,a),{});
 const report={generated_at:new Date().toISOString(),mode:'DRY_RUN_READ_ONLY',project:'dfl-painel',
  counts,products:products.length,movements:movs.length,supplies:supplies.length,writes_executed:0,
  rules:[
   'SAFE_PRESENTATION pode alterar somente presentations após aprovação',
   'RELABEL_FORENSIC nunca reinterpreta histórico automaticamente',
   'SCALE_BASE exige prova matemática e fator único antes de proposta',
   'average_cost não é alterado sem reconstrução comprovada',
   'movimentos e snapshots de compras são imutáveis nesta fase'
  ],plans};
 fs.writeFileSync(O,JSON.stringify(report,null,2));

 let txt=`DFL V24.8 R5.2 — FORENSIC MIGRATION PLANNER\nMODE: DRY_RUN_READ_ONLY | WRITES: 0\nProdutos=${products.length} Movimentos=${movs.length} Compras=${supplies.length}\n\n`;
 txt+='LANES\n'+Object.entries(counts).map(([k,v])=>`${k}: ${v}`).join('\n')+'\n';
 for(const x of plans){
  txt+=`\n============================================================\n[${x.lane}] ${x.product.name}\nID: ${x.product.id}\nStatus: ${x.status}\n`;
  txt+=`ANTES: base=${x.product.unit} saldo=${x.product.current_quantity} mínimo=${x.product.minimum_quantity} meta=${x.product.ideal_quantity} custo=${x.product.average_cost}\n`;
  if(x.target_unit)txt+=`CANDIDATO: base ${x.product.unit} -> ${x.target_unit}; fator=${x.scale_factor}\n`;
  if(x.presentation_fixes.length) for(const f of x.presentation_fixes) txt+=`SAFE: ${f.label}: ${f.before.purchase_unit}×${f.before.conversion_quantity} -> ${f.after.purchase_unit}×${f.after.conversion_quantity}\n`;
  if(x.evidence.length)txt+=`EVIDÊNCIA: ${x.evidence.join(' | ')}\n`;
  if(x.blockers.length)txt+=`BLOQUEIOS: ${x.blockers.join(' | ')}\n`;
  if(x.semantic_break_candidates.length)txt+=`CORTES POSSÍVEIS: ${x.semantic_break_candidates.map(b=>b.dates.join(' -> ')).join(' ; ')}\n`;
  txt+=`TIMELINE (${x.timeline.length}): ${x.timeline.map(e=>`${e.date||'?'} ${e.type||'?'} q=${e.quantity} bal=${e.balance}`).join(' | ')}\n`;
  txt+=`PROPOSTA DE WRITE: ${x.proposed_write?'SIM, somente presentations':'NÃO'}\n`;
 }
 fs.writeFileSync(T,txt);
 console.log(txt);
 console.log(`\nJSON: ${O}\nTXT: ${T}`);
})().catch(e=>{console.error(e);process.exit(1)});
