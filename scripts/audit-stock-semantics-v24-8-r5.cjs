const fs=require('fs');
const path=require('path');
const {getApps,initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');

if(!getApps().length){
 initializeApp({credential:applicationDefault(),projectId:'dfl-painel'});
}
const db=getFirestore();

const OUT=process.env.R5_OUT;
const TXT=process.env.R5_TXT;
const round=(n,d=6)=>Number(Number(n||0).toFixed(d));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const commercial=new Set(['pct','cx','fardo']);
const physical=new Set(['un','kg','g','l','ml']);
const qty=d=>Number(d.quantity ?? d.quantidade ?? d.amount ?? 0);
const productId=d=>String(d.product_id ?? d.productId ?? d.stock_product_id ?? d.stockProductId ?? '');
const created=d=>String(d.created_at ?? d.createdAt ?? d.date ?? d.data ?? '');
const cost=d=>Number(d.total_cost ?? d.totalCost ?? d.cost ?? d.custo_total ?? d.price ?? d.preco ?? 0);
const presentationFactor=p=>Number(p?.conversion_quantity||0);

async function collection(name){
 try{
  const snap=await db.collection(name).get();
  return snap.docs.map(x=>({id:x.id,...x.data()}));
 }catch(e){return[]}
}

(async()=>{
 const names=['stockProducts','stock_products','stockMovements','stock_movements','stockSupplies','stock_supplies'];
 const data={};
 for(const n of names)data[n]=await collection(n);

 const products=(data.stockProducts.length?data.stockProducts:data.stock_products);
 const movements=(data.stockMovements.length?data.stockMovements:data.stock_movements);
 const supplies=(data.stockSupplies.length?data.stockSupplies:data.stock_supplies);

 const rows=products.map(p=>{
  const pm=movements.filter(m=>productId(m)===p.id);
  const ps=supplies.filter(s=>productId(s)===p.id);
  const unit=String(p.unit||'');
  const presentations=Array.isArray(p.presentations)?p.presentations:[];
  const activePresentations=presentations.filter(x=>x&&x.active!==false);
  const factors=[...new Set(activePresentations.map(presentationFactor).filter(x=>x>0))];
  const outs=pm.filter(m=>{
   const t=norm(m.type??m.kind??m.movement_type??m.tipo);
   return /saida|out|consumo/.test(t)&&!/(estorno|revers|correc|ajuste|contagem|saldo inicial)/.test(t)&&!(m.supply_id||m.supplyId);
  });
  const ins=pm.filter(m=>/entrada|in|compra/.test(norm(m.type??m.kind??m.movement_type??m.tipo)));
  const fractional=pm.filter(m=>Math.abs(qty(m)-Math.round(qty(m)))>1e-9).length;
  const sampleOut=outs.slice(-8).map(m=>({date:created(m),quantity:round(qty(m)),balance:round(m.balance_after??m.balance??0)}));
  const sampleSupply=ps.slice(-6).map(s=>({date:created(s),quantity:round(qty(s)),cost:round(cost(s),2),purchase_unit:s.purchase_unit??s.purchaseUnit??null,presentation_id:s.presentation_id??s.presentationId??null}));
  const name=String(p.name||'');
  const canonicalLike=products.find(x=>x.id!==p.id&&norm(x.name)===norm(name)&&physical.has(String(x.unit||'')));
  let classification='KEEP',confidence='medium',reasons=[];

  const badPresentation=activePresentations.some(x=>{
   const pu=String(x.purchase_unit||'');
   const f=presentationFactor(x);
   return (pu==='un'&&f>1&&unit==='un') || (commercial.has(pu)&&f<=1&&unit==='un'&&/\d+\s*(un|und|unid)/i.test(String(x.label||name)));
  });
  if(badPresentation){classification='PRESENTATION_FIX_SAFE';confidence='high';reasons.push('apresentação comercial parece taxonomicamente inconsistente com base física');}

  if(commercial.has(unit)){
   const physicalHint=/\b\d+\s*(un|und|unid|g|kg|ml|l)\b/i.test(name) || activePresentations.some(x=>physical.has(String(x.purchase_unit||''))||presentationFactor(x)>1) || !!canonicalLike;
   if(physicalHint){
    const storedLooksPhysical=(Number(p.current_quantity||0)>10 || outs.some(m=>Math.abs(qty(m))>5)) && Number(p.average_cost||0)>0 && Number(p.average_cost||0)<2;
    const storedLooksPackages=(Number(p.current_quantity||0)<=5 && ps.some(s=>qty(s)<=5) && (Number(p.average_cost||0)>=2 || sampleSupply.some(s=>s.cost>=2)));
    if(storedLooksPhysical){
      classification='RELABEL_ONLY_CANDIDATE';confidence='medium-high';
      reasons.push('unidade comercial, mas magnitudes/custo sugerem números já armazenados como unidades físicas');
    }else if(storedLooksPackages){
      classification='SCALE_BASE_CANDIDATE';confidence='medium';
      reasons.push('unidade comercial e saldos/compras parecem contados em embalagens');
    }else{
      classification='REVIEW';confidence='low';
      reasons.push('unidade comercial com histórico; evidência insuficiente para escolher relabel ou escala');
    }
   }
  }
  if(fractional>0&&unit==='un'&&classification==='KEEP'){
   classification='REVIEW';confidence='low';reasons.push('unidade inteira possui movimentações fracionárias');
  }

  const candidateFactors=[...new Set([
    ...factors.filter(x=>x>1),
    ...(canonicalLike?.presentations||[]).map(presentationFactor).filter(x=>x>1)
  ])].sort((a,b)=>a-b);

  return {
   id:p.id,name,active:p.active!==false,unit,
   current_quantity:round(p.current_quantity),minimum_quantity:round(p.minimum_quantity),
   ideal_quantity:round(p.ideal_quantity),average_cost:round(p.average_cost,4),
   movement_count:pm.length,out_count:outs.length,in_count:ins.length,fractional_movement_count:fractional,
   presentations:activePresentations.map(x=>({id:x.id,label:x.label,purchase_unit:x.purchase_unit,conversion_quantity:round(x.conversion_quantity),active:x.active!==false})),
   canonical_counterpart:canonicalLike?{id:canonicalLike.id,unit:canonicalLike.unit,active:canonicalLike.active!==false,presentations:canonicalLike.presentations||[]}:null,
   candidate_factors:candidateFactors,
   classification,confidence,reasons,sample_out:sampleOut,sample_supplies:sampleSupply,
   proposed_write:null
  };
 }).sort((a,b)=>{
  const rank={REVIEW:0,SCALE_BASE_CANDIDATE:1,RELABEL_ONLY_CANDIDATE:2,PRESENTATION_FIX_SAFE:3,KEEP:4};
  return rank[a.classification]-rank[b.classification]||a.name.localeCompare(b.name,'pt-BR');
 });

 const summary=rows.reduce((a,r)=>(a[r.classification]=(a[r.classification]||0)+1,a),{});
 const report={
  generated_at:new Date().toISOString(),mode:'READ_ONLY',project:'dfl-painel',
  collections:{products:products.length,movements:movements.length,supplies:supplies.length},
  summary,write_count:0,
  guarantees:[
   'nenhuma escrita Firestore',
   'nenhuma alteração de saldo, mínimo, meta, custo ou histórico',
   'RELABEL_ONLY e SCALE_BASE são apenas candidatos nesta fase',
   'average_cost não é recalculado automaticamente',
   'supply snapshots históricos permanecem intocados'
  ],
  rows
 };
 fs.writeFileSync(OUT,JSON.stringify(report,null,2));
 const attention=rows.filter(r=>r.classification!=='KEEP');
 let text=`DFL V24.8 R5 — AUDITORIA SEMÂNTICA REAL\nModo: READ-ONLY\nProdutos: ${products.length} | Movimentos: ${movements.length} | Compras: ${supplies.length}\nWrites: 0\n\nRESUMO\n`;
 for(const [k,v] of Object.entries(summary))text+=`${k}: ${v}\n`;
 text+=`\nCASOS PARA DECISÃO (${attention.length})\n`;
 for(const r of attention){
  text+=`\n[${r.classification}] ${r.name} (${r.id})\n`;
  text+=`  base=${r.unit} saldo=${r.current_quantity} mínimo=${r.minimum_quantity} meta=${r.ideal_quantity} custo_médio=${r.average_cost}\n`;
  text+=`  movimentos=${r.movement_count} saídas=${r.out_count} fracionários=${r.fractional_movement_count} fatores=[${r.candidate_factors.join(', ')}]\n`;
  if(r.presentations.length)text+=`  apresentações: ${r.presentations.map(p=>`${p.label||'?'}:${p.purchase_unit}×${p.conversion_quantity}`).join(' | ')}\n`;
  if(r.canonical_counterpart)text+=`  contraparte: ${r.canonical_counterpart.id} base=${r.canonical_counterpart.unit} ativa=${r.canonical_counterpart.active}\n`;
  text+=`  confiança=${r.confidence}; ${r.reasons.join('; ')}\n`;
  if(r.sample_out.length)text+=`  saídas amostra: ${r.sample_out.map(x=>`${x.quantity}@${x.date||'?'}`).join(', ')}\n`;
  if(r.sample_supplies.length)text+=`  compras amostra: ${r.sample_supplies.map(x=>`${x.quantity}/${x.cost}@${x.date||'?'}`).join(', ')}\n`;
 }
 fs.writeFileSync(TXT,text);
 console.log(text);
 console.log(`\nJSON: ${OUT}\nTXT: ${TXT}`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
