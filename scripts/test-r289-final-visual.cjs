const fs = require('fs');
const assert = require('assert/strict');
const ts = require('typescript');
const path = require('path');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
function ok(v,n){assert.ok(v,n);checks++;}
for(const p of ['components/store/SiteInboxPanel.tsx','app/mais/mensageria/page.tsx','components/messaging/MessagingOrderPicker.tsx','lib/operation/site-order-presentation.ts']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'AST '+p);
}
const h=read('components/store/SiteInboxPanel.tsx');
for(const token of ['siteOrderDisplayReference(item)','siteOrderDisplayReference(delivery)','siteHistoryCompactId(item)','siteHistoryTime(item)','Mostrar ID completo','{item.external_order_id||item.order_id||item.id}','Ver ocorrência e motivo','archiveSiteDelivery(archiveId,reason)','allocate(delivery.id','Ver detalhes do pedido'])ok(h.includes(token),'Site preserva '+token);
const m=read('app/mais/mensageria/page.tsx');
for(const token of ['MessagingOrderPicker deliveries={deliveries} selectedId={deliveryId} onSelect={setDeliveryId}','isSuperadminUid','role="alert"','Consultar panorama','dfl-m4-id','id ? `?deliveryId=${encodeURIComponent(id)}` : \'\'','Nenhuma consulta dispara mensagens.'])ok(m.includes(token),'M8 preserva '+token);
const picker=read('components/messaging/MessagingOrderPicker.tsx');
for(const token of ['maskedMessagePhone','onSelect(item.id)','role="listbox"','aria-selected','slice(0, 120)','slice(0, 15)','aria-expanded={open}','onClick={()=>{onSelect(item.id)'])ok(picker.includes(token),'picker '+token);
for(const prohibited of ['fetch(', 'sendWhatsApp','getDocs(', 'onSnapshot(', 'setDoc(', 'runTransaction(', 'localStorage.setItem'])ok(!picker.includes(prohibited),'picker somente leitura '+prohibited);
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r289-final-visual.cjs'") && pre.includes("'scripts/test-r288-mensagens-imagens.cjs'"),'R288 e R289 integradas no gate');
const helperSrc=read('lib/operation/site-order-presentation.ts');
const compiled=ts.transpileModule(helperSrc,{fileName:'lib/operation/site-order-presentation.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out={exports:{}};new Function('module','exports',compiled)(out,out.exports);
const f=out.exports;
ok(f.siteOrderDisplayReference({order_id:'1042',id:'x'})==='Pedido #1042','numero comercial reconhecido');
ok(f.siteOrderDisplayReference({order_id:'site-order-a817381',id:'internal-45'})==='Pedido do Site','UUID tecnico nunca se torna pedido');
ok(f.maskedMessagePhone('34 99988-1122')==='•••• 1122','telefone mascarado');
ok(f.maskedMessagePhone('')==='Telefone não informado','ausencia telefone honesta');
ok(!f.maskedMessagePhone('34999881122').includes('3499988'),'nao revela numero completo');
console.log('R289_FINAL_VISUAL_OK:',checks,'verificações. Nenhuma rede, mensagem enviada ou mutação de pedido.');
