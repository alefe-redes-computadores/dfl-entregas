'use strict';
const fs=require('fs');
const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const key=process.env.GOOGLE_APPLICATION_CREDENTIALS;
if(!key||!fs.existsSync(key))throw new Error('GOOGLE_APPLICATION_CREDENTIALS ausente.');
if(!getApps().length)initializeApp({credential:cert(require(key))});
const db=getFirestore(),pack=new Set(['pct','cx','fardo']),n=v=>Number(v),finite=v=>Number.isFinite(n(v));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
async function load(c){const s=await db.collection(c).get();return s.docs.map(d=>({id:d.id,...d.data()}))}
(async()=>{
 const [products,movements,supplies]=await Promise.all([load('stock_products'),load('stock_movements'),load('stock_supplies')]);
 const rows=products.map(p=>{
  const pm=movements.filter(m=>m.product_id===p.id), outs=pm.filter(m=>String(m.type).toLowerCase()==='saida'||String(m.type).toLowerCase()==='out');
  const ps=[]; for(const s of supplies)for(const i of s.items||[])if(i.stock_product_id===p.id)ps.push({supply_id:s.id,item:i});
  const pres=(p.presentations||[]).filter(x=>x&&x.active!==false);
  const reasons=[]; let score=0;
  if(pack.has(p.unit)){score+=2;reasons.push('base_em_embalagem_comercial')}
  if(pres.some(x=>pack.has(p.unit)&&finite(x.conversion_quantity)&&n(x.conversion_quantity)>1)){score+=3;reasons.push('embalagem_converte_para_varias_embalagens_base')}
  if(outs.some(m=>finite(m.quantity)&&finite(p.current_quantity)&&n(m.quantity)>=100&&n(p.current_quantity)<=n(m.quantity)*2)){score+=2;reasons.push('saida_muito_grande_vs_saldo')}
  const repeated=outs.map(m=>n(m.quantity)).filter(Number.isFinite); if(repeated.length>=3&&new Set(repeated.slice(0,5)).size===1&&repeated[0]>=10){score+=2;reasons.push('saidas_grandes_repetidas')}
  if(pm.some(m=>!finite(m.quantity)||!finite(m.balance_before)||!finite(m.balance_after))){score+=4;reasons.push('historico_numerico_incompleto')}
  if(pres.some(x=>finite(x.conversion_quantity)&&n(x.conversion_quantity)<=0)){score+=4;reasons.push('conversao_invalida')}
  if(p.average_cost&&pack.has(p.unit)&&pres.some(x=>finite(x.conversion_quantity)&&n(x.conversion_quantity)>1)){score+=1;reasons.push('custo_pode_estar_na_semantica_errada')}
  const risk=score>=6?'high':score>=3?'medium':score?'low':'ok';
  return {id:p.id,name:p.name,active:p.active!==false,category:p.category,unit:p.unit,current_quantity:p.current_quantity,minimum_quantity:p.minimum_quantity,ideal_quantity:p.ideal_quantity??null,average_cost:p.average_cost??null,risk,score,reasons,presentations:pres.map(x=>({id:x.id,label:x.label,purchase_unit:x.purchase_unit,conversion_quantity:x.conversion_quantity})),history:{movements:pm.length,outs:outs.length,supplies:ps.length,recent_outs:outs.slice(0,8).map(m=>({id:m.id,quantity:m.quantity,balance_before:m.balance_before,balance_after:m.balance_after,occurred_at:m.occurred_at,presentation_label:m.presentation_label??null,presentation_quantity:m.presentation_quantity??null,presentation_unit:m.presentation_unit??null,conversion_quantity:m.conversion_quantity??null}))},brain_guard_recommended:risk==='high'};
 });
 rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
 const report={version:'V24.8-R2',mode:'READ_ONLY',generated_at:new Date().toISOString(),totals:{products:products.length,movements:movements.length,supplies:supplies.length,high:rows.filter(x=>x.risk==='high').length,medium:rows.filter(x=>x.risk==='medium').length,low:rows.filter(x=>x.risk==='low').length,ok:rows.filter(x=>x.risk==='ok').length},products:rows,notes:['Risco é triagem, não autorização de migração.','pct/cx/fardo não são considerados errados isoladamente.','Nenhum fator físico é inferido automaticamente.']};
 const json=JSON.stringify(report,null,2);if(process.env.DFL_V248_R2_REPORT)fs.writeFileSync(process.env.DFL_V248_R2_REPORT,json+'\n');console.log(json);console.error('V24.8 R2 READ_ONLY: ZERO escritas.');
})().catch(e=>{console.error(e);process.exit(1)});
