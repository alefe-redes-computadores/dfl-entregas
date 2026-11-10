#!/usr/bin/env node
'use strict';
/** R310: testes hermeticos sem rede: 1 campo, consentimento, itens, regressao. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const form=fs.readFileSync('app/entregas/nova/page.tsx','utf8');
const src=fs.readFileSync('lib/integration/manualPickupPolicy.ts','utf8');
let n=0;const ok=(x,s)=>{assert.ok(x,s);n++};const eq=(a,b,s)=>{assert.equal(a,b,s);n++};
for(const [f,s] of [['nova.tsx',form],['manualPickupPolicy.ts',src]]){
 const sf=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 eq(sf.parseDiagnostics.length,0,`TS parser ${f}`);
}
ok(!form.includes('Avisar no Zap'),'botao duplicado retirado no NOVO pedido');
eq(form.split('checked={notifyWhatsapp}').length-1,1,'uma caixa unica de opt-in no NOVO pedido');
ok(form.includes('setConfirmedWhatsappRecipient(event.target.checked ? consentRecipientKey'), 'opt-in individual preservado');
ok(!form.includes('setNotifyWhatsappPreference'),'nao existe autorizacao implicita por preferencia');
ok(form.includes('consentPhone.length >= 10') && form.includes('confirmedWhatsappRecipient === consentRecipientKey'),'telefone e cliente vinculam consentimento');
ok(form.includes("origin === 'loja'"),'nao enviar por origem marketplace');
ok(form.includes("manual_order_items:origin==='loja'"),'texto comercial ainda e salvo');
ok(form.includes('Aparece na conferência e no aviso de recebimento'), 'texto orienta corretamente operador');
ok(!form.includes('notifyWhatsappPreference'),'nenhum toggle paralelo remanescente');
const js=ts.transpileModule(src,{fileName:'manualPickupPolicy.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded={};vm.runInNewContext(js,{exports:loaded,require:key=>{if(key!=='./manualMessagingPolicy')throw Error('dependencia inesperada '+key);return{normalizeManualMessagePhone:v=>{let s=String(v||'').replace(/\D/g,'');return /^55[1-9]\d{9,10}$/.test(s)?s:/^[1-9]\d{9,10}$/.test(s)?'55'+s:null}}},Date,Math,Number,String,Set,Map,RegExp,console},{timeout:4000});
const parse=loaded.manualPickupItems;
eq(typeof parse,'function','parser de descricao disponivel');
eq(JSON.stringify(parse('2 Armaria e 1 Fanta 1 L')),JSON.stringify([{name:'Armaria',quantity:2},{name:'Fanta 1 L',quantity:1}]),'quantidades manuais');
eq(JSON.stringify(parse('1x Bão; 3x Uai')),JSON.stringify([{name:'Bão',quantity:1},{name:'Uai',quantity:3}]),'separadores e x');
eq(JSON.stringify(parse('')),JSON.stringify([]),'sem descricao permanece sem itens');
ok(parse('3 Burger').length===1,'item unico');
ok(parse('99 Unidades')[0].quantity===1,'quantidade anormal nao inferida');
const t=Date.now(),dt=new Date(t-900).toISOString();
const base={id:'dfl-12345678-1234-1234-1234-123456789abc',origin:'loja',fulfillment_mode:'pickup',
 customer_name:'Cliente',phone:'34999999999',notify_whatsapp:true,manual_messaging_opt_in_v1:true,created_at:dt,manual_order_items:'2 Armaria e 1 Fanta 1 L',customer_charge:30,payment_method:'pix'};
const plan=(override={},reason='created')=>loaded.planManualPickup({delivery:{...base,...override},reason,now:t});
let p=plan();ok(p.eligible,'retirada consentida segue elegivel');
eq(JSON.stringify(p.payload.items),JSON.stringify([{name:'Armaria',quantity:2},{name:'Fanta 1 L',quantity:1}]),'itens chegam a payload.items do worker');
ok(!('items' in plan({manual_order_items:''}).payload),'sem descricao sem bloco inventado');
ok(!('items' in plan({pickup_ready_at:new Date(t-200).toISOString()},'ready').payload),'prontidao nao reenvia itens');
ok(!plan({notify_whatsapp:false}).eligible,'consentimento obrigatorio');
ok(!plan({source_system:'dfl_site'}).eligible,'site separado');
ok(!plan({origin:'ifood'}).eligible,'marketplaces fora');
ok(!plan({developer_test:true,owner_order_context:'owner_test'}).eligible,'dono sem canario continua bloqueado');
ok(loaded.planManualPickup({delivery:{...base,developer_test:true,owner_order_context:'owner_test'},reason:'created',now:t,allowOwnerPilot:true}).eligible,'R309 proprio piloto preservado');
ok(src.includes('reason === \'created\''),'itens apenas recebimento');
console.log(`R310: ${n} verificacoes locais aprovadas; sem rede, Firestore, WhatsApp ou credenciais.`);
