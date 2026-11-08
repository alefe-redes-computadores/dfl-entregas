/* P11: casos executaveis + protecoes arquiteturais. Nao utiliza rede ou Firestore. */
const fs=require('node:fs');
const Module=require('node:module');
const assert=require('node:assert/strict');
const ts=require('typescript');
let count=0;
function test(label,fn){try{fn();console.log('OK:',label);count++;}catch(e){console.error('FALHOU:',label,e);process.exitCode=1;}}
function loadTs(file){const src=fs.readFileSync(file,'utf8');const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(compiled,file);return m.exports;}
const places=loadTs('lib/operation/neighborhood-intelligence.ts');
const advice=loadTs('lib/operation/customer-payment-guidance.ts');
const map=places.neighborhoodForReport;
test('Quebec e Jardim Quebec agrupados',()=>{assert.equal(map('Quebec'),'Jardim Quebec');assert.equal(map('Jardim Quebec'),'Jardim Quebec');assert.equal(map('jardim kbek'),'Jardim Quebec');assert.equal(map('kbek'),'Jardim Quebec');});
test('Esperanca sem acento reconhecida',()=>assert.equal(map('Jd. Esperanca'),'Jardim Esperança'));
test('N. Sra. de Fatima reconhecida',()=>assert.equal(map('N. Sra. de Fatima'),'Nossa Senhora de Fátima'));
test('Fatima isolado exige revisao',()=>{const r=places.resolveNeighborhood('Fátima');assert.equal(r.canonical,null);assert.equal(r.reviewRequired,true);assert.ok(r.candidates.includes('Nossa Senhora de Fátima'));});
test('Etapas 2 e 3 nao sao fundidas automaticamente',()=>{for(const v of ['Ipanema 2','Ipanema 3','Jardim Quebec 2','Quebec 2']){assert.equal(map(v),v);assert.equal(places.resolveNeighborhood(v).reviewRequired,true);}});
test('Bairro desconhecido preserva identidade',()=>{assert.equal(map('Jardim Xpto'),'Jardim Xpto');assert.equal(map(null),null);});
test('Auditoria reune variantes sem editar clientes',()=>{const cs=[{id:'1',neighborhood:'kbek'},{id:'2',neighborhood:'Quebec'},{id:'3',neighborhood:'Jardim Quebec'},{id:'4',neighborhood:'Ipanema 2'}];const original=JSON.stringify(cs);const audit=places.auditNeighborhoods(cs);const group=audit.find(g=>g.label==='Jardim Quebec');assert.equal(group.customers,3);assert.equal(group.kind,'aliases');assert.equal(JSON.stringify(cs),original);});
test('Sem observacao, sem recomendacao',()=>{const g=advice.customerPaymentGuidance({},[]);assert.equal(g.level,'none');});
test('Uma observacao generica nao acusa inadimplencia',()=>{const c={operational_review:{state:'observacao',reason:'cliente nao atendeu a porta',events:[]}};assert.equal(advice.customerPaymentGuidance(c,[]).level,'review');});
test('Prepagamento exige ocorrencia financeira vinculada a pedido nao pago',()=>{const c={operational_review:{state:'observacao',reason:'Pagamento Pix ainda nao confirmado',events:[{state:'observacao',reason:'Pagamento Pix ainda nao confirmado',related_delivery_id:'real-1'}]}};const d=[{id:'real-1',completed:true,is_paid:false,payment_state:'pending'}];assert.equal(advice.customerPaymentGuidance(c,d).level,'prepaid_recommended');assert.equal(advice.customerPaymentGuidance(c,[{...d[0],payment_state:'paid'}]).level,'review');assert.equal(advice.customerPaymentGuidance(c,[{...d[0],completed:false}]).level,'review');});
test('Revisao encerrada cancela recomendacao',()=>{const c={operational_review:{state:'revisado',reason:'Pagamento Pix ainda nao confirmado',events:[{state:'observacao',reason:'Pagamento Pix ainda nao confirmado',related_delivery_id:'real-1'}]}};assert.equal(advice.customerPaymentGuidance(c,[{id:'real-1',completed:true,is_paid:false}]).level,'none');});
test('Ranking de bairros usa normalizacao e NAO altera clientes',()=>{const src=fs.readFileSync('lib/reports/buildReportModel.ts','utf8');assert.ok(src.includes('return neighborhoodForReport(customer?.neighborhood)'));assert.ok(!src.includes('updateDoc('));});
test('Intelligence nao envia mensagem nem registra pagamento',()=>{const src=fs.readFileSync('app/mais/inteligencia/page.tsx','utf8');assert.ok(src.includes('isSuperadminUid'));assert.ok(!/\b(sendWhatsapp|sendMessage|updateDoc|runTransaction|setDoc)\b/.test(src));});
test('Dashboard integra inteligencia, auditoria e orientacao financeira',()=>{const more=fs.readFileSync('app/mais/page.tsx','utf8'),reports=fs.readFileSync('app/relatorios/page.tsx','utf8'),clients=fs.readFileSync('app/clientes/inteligencia/page.tsx','utf8');assert.ok(more.includes("router.push('/mais/inteligencia')"));assert.ok(reports.includes('<NeighborhoodAuditPanel customers={customers} />'));assert.ok(clients.includes('customerPaymentGuidance'));});
test('PRE-APK conserva suite anterior e inclui P11',()=>{const s=fs.readFileSync('scripts/pre-apk.cjs','utf8');assert.ok(s.includes('test-r299-p10a-future-route.cjs'));assert.ok(s.includes('test-r299-p11-intelligence-macro.cjs'));assert.ok(s.includes('test-r299-tracking-auto-p9.cjs'));});
test('Graficos apresentam categorias sem truncar texto nos resumos',()=>{const s=fs.readFileSync('components/reports/ReportChartCard.tsx','utf8');assert.ok(s.includes('Valores legíveis:'));assert.ok(s.includes('break-words'));assert.ok(s.includes('chartData.some(item => item.label.length > 15)'));});
if(!process.exitCode)console.log(`R299 P11: ${count} contratos direcionados aprovados, sem rede nem Firestore.`);
