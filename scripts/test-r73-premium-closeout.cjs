#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let checks=0;
const read=p=>fs.readFileSync(p,'utf8');
const ok=(value,label)=>{assert.ok(value,'R73: '+label);checks++};
const same=(actual,expected,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,'R73: '+label);checks++};
const files=['components/ui/PremiumChoicePicker.tsx','app/entregas/retornos/page.tsx',
 'app/mais/comunicacao/page.tsx','app/mais/page.tsx','app/mais/inteligencia/page.tsx',
 'components/store/PerformanceModals.tsx','components/stock-supplies/StockProductPicker.tsx',
 'lib/operation/r73-intelligence-pulse.ts'];
for(const path of files){
 const source=read(path);
 const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(!tree.parseDiagnostics.length,`AST ${path}`);
}
const picker=read(files[0]);
for(const value of ['rootRef','triggerRef','pointerdown','Escape','ArrowDown','role="option"','triggerRef.current?.focus()'])ok(picker.includes(value),'seletor acessivel '+value);
const returns=read(files[1]);
for(const value of ['role="dialog"','aria-modal="true"','autoFocus','confirmId!==id','isSyntheticOperationalRoute(x)','Confirmar rota','setConfirmId(null)'])ok(returns.includes(value),'confirmacao segura '+value);
ok(!returns.includes('window.confirm('),'reentrega sem confirmacao nativa');
ok(returns.includes('await updateDelivery(id,{route_id:target.id,return_to_store:null})'),'reentrega persiste pelo motor existente');
ok(!/\bsetDoc\s*\(|\brunTransaction\s*\(/.test(returns),'sem nova escrita direta Firestore');
const comm=read(files[2]);
ok(!comm.includes('Emissão automática de link permanece OFF até Gate'),'texto obsoleto de rollout removido');
ok(comm.includes('permissões efetivas')&&comm.includes('não comprova o recebimento'),'distingue rollout de entrega real');
const more=read(files[3]);
ok(more.includes('>Central de Mensageria</span>')&&more.includes('>Acompanhamento privado</span>'),'acessos nao rotulados legados');
const intelligence=read(files[4]);
ok(intelligence.includes('r73IntelligencePulse(deliveries,routes)'),'inteligencia usa pulso explicavel');
ok(intelligence.includes("router.push('/entregas/retornos')"),'navega para retorno existente');
ok(!/\b(sendWhatsapp|sendMessage|updateDoc|runTransaction|setDoc)\b/.test(intelligence),'nao aciona operacao da inteligencia');
const performance=read(files[5]);
ok(performance.includes('const {isLogisticsOpen,isRevenueOpen,closeRevenue,closeLogistics}=props;'),'efeito depende de campos estaveis');
ok(!performance.includes('[props.isLogisticsOpen, props.isRevenueOpen, props.closeRevenue, props.closeLogistics]'),'sem dependencia do objeto props');
ok(!read(files[6]).includes('aria-invalid={invalid}'),'botao nao usa aria-invalid ilegal');
const mocks={
 '@/lib/integration/site-order':{isCancelledSiteDelivery:d=>d.source_system==='dfl_site'&&['cancelado','cancelled'].includes(d.site_order_status)},
 '@/lib/delivery-mode':{isDeliveryFulfillment:d=>!d.fulfillment_mode||d.fulfillment_mode==='delivery'},
 '@/lib/operational-time':{isSyntheticOperationalRoute:r=>r.id==='balcao'},
 '@/lib/operation/return-to-store':{isAwaitingRedelivery:d=>d.completed!==true&&!!(d.return_to_store&&d.return_to_store.route_id===d.route_id&&d.return_to_store.attempt_id&&Date.parse(d.return_to_store.at))},
};
const path='lib/operation/r73-intelligence-pulse.ts';const output=ts.transpileModule(read(path),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};vm.runInNewContext(output,{exports:mod.exports,module:mod,require:id=>{if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];throw Error('Import inesperado: '+id)},Date,Number}, {filename:path});
const d=(id,more={})=>({id,route_id:'',completed:false,fulfillment_mode:'delivery',...more});
const pulse=mod.exports.r73IntelligencePulse([
 d('a'),d('b',{fulfillment_mode:'pickup'}),d('c',{source_system:'dfl_site',site_order_status:'cancelado'}),
 d('d',{developer_test:true}),d('e',{exclude_from_reports:true}),d('f',{operational_dismissed_at:'2026-11-01'}),
 d('g',{route_id:'r1',return_to_store:{route_id:'r1',attempt_id:'a1',at:'2026-11-15T10:00:00Z'}}),
 d('h',{route_id:'r1',completed:true}),d('i',{fulfillment_mode:'external_delivery'}),
 ],[{id:'r1',status:'aberta',started_at:'2026-11-15T10:00:00Z'},{id:'balcao',status:'aberta',started_at:'2026-11-15T10:00:00Z'}]);
same(pulse,{queued:1,returns:1,routesOnStreet:1},'exclusoes, retornos e rotas reais');
const immut=[d('x')], routes=[{id:'r1',status:'aberta',started_at:'2026-11-15T10:00:00Z'}];
const before=JSON.stringify({immut,routes});mod.exports.r73IntelligencePulse(immut,routes);ok(JSON.stringify({immut,routes})===before,'leitura pura e sem mutacao');
const gate=read('scripts/pre-apk.cjs');ok(gate.includes("'scripts/test-r73-premium-closeout.cjs'"),'integrado ao PRE-APK');
for(const legacy of ['scripts/test-r72-p2-premium.cjs','scripts/test-r72-operation.cjs'])ok(fs.existsSync(legacy),'regressao preservada '+legacy);
console.log(`R73 FECHAMENTO PREMIUM: ${checks} verificacoes executaveis / AST aprovadas, sem rede, writes ou WhatsApp`);
