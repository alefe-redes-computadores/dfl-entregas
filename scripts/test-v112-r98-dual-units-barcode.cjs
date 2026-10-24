#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
let checks = 0;
const ok = (v, msg) => { assert.ok(v, 'R98: ' + msg); checks++; console.log('OK R98:', msg); };
const source = fs.readFileSync('lib/stock-dual-unit.ts', 'utf8');
const js = ts.transpileModule(source, { fileName: 'stock-dual-unit.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = {};
new Function('exports', 'require', js)(exported, id => {
 if (id === '@/lib/stock-quantity') return { formatStockQuantity: (amount,unit) => `${amount.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${unit}` };
 throw Error('Unknown import '+id);
});
const {dualStockView,looseMovementPresentation,stockMovementBaseQuantity} = exported;
const legacy = size => ({ id:'egg',name:'Ovos',unit:'pct',current_quantity:0.5,presentations:[{id:'legacy-'+size,label:`Cartela com ${size} ovos`,purchase_unit:'un',conversion_quantity:size,active:true}] });
const standard = size => ({ id:'egg',name:'Ovos',unit:'un',current_quantity:size/2,presentations:[{id:'standard-'+size,label:`Cartela com ${size} ovos`,purchase_unit:'pct',conversion_quantity:size,active:true}] });
for(const size of [20,30]) {
 const a=dualStockView(legacy(size));
 ok(a.mode==='legacy_package'&&a.secondary.includes(String(size/2))&&a.primary.includes('cartela'),`meia cartela legada de ${size} = ${size/2} unidades`);
 const loose=looseMovementPresentation(legacy(size));
 ok(loose.id==='__loose-unit'&&Math.abs(loose.conversion_quantity-1/size)<1e-12,`unidade avulsa usa 1/${size} da base, nunca ${size} cartelas`);
 const b=dualStockView(standard(size));
 ok(b.mode==='base_units'&&b.secondary.includes('0,5'),`cadastro em unidades exibe 0,5 cartela de ${size}`);
 ok(looseMovementPresentation(standard(size))===null,'cadastro padrão já permite baixa em un');
}
ok(dualStockView({id:'odd',unit:'pct',current_quantity:0.5,presentations:[{id:'p',label:'Unidade',purchase_unit:'un',conversion_quantity:30,active:true}]})===null,'legado ambíguo não inverte fator sem autorização');
ok(dualStockView({id:'odd',unit:'pct',current_quantity:0.5,loose_units_per_package:30,presentations:[{id:'p',label:'Unidade',purchase_unit:'un',conversion_quantity:30,active:true}]})?.secondary.includes('15'),'conversão explícita habilita 15 unidades');
let current=1;const factor=1/30;
for(let i=0;i<30;i++){
 const amount=stockMovementBaseQuantity(1,factor,current,{loose:true,direction:'remove'});
 ok(amount>0&&amount<=current+1e-9,`baixa avulsa ${i+1}/30 dentro do saldo`);
 current=Number((current-amount).toFixed(4));
}
ok(current===0,'30 baixas de 1 ovo zeram 1 cartela sem resíduo');
ok(stockMovementBaseQuantity(1,factor,0.03,{loose:true,direction:'remove'})>0.03,'não autoriza uma unidade com saldo de 0,9 unidade');
ok(stockMovementBaseQuantity(0,factor,1,{loose:true,direction:'remove'})===0,'zero não cria saída');
ok(stockMovementBaseQuantity(15,factor,1,{loose:true,direction:'remove'})===0.5,'15 ovos = 0,5 cartela');
ok(dualStockView({...legacy(30),presentations:[{id:'bad',purchase_unit:'un',conversion_quantity:0,active:true}]})===null,'fator inválido não libera baixa');
ok(dualStockView({...legacy(30),presentations:[{id:'off',purchase_unit:'un',conversion_quantity:30,active:false}]})===null,'apresentação pausada não habilita conversão');
ok(dualStockView({unit:'kg',current_quantity:0.4,presentations:[]})===null,'não inventar conversão de peso');
const paths=['app/estoque/movimentar/page.tsx','app/estoque/page.tsx','app/estoque/detalhes/page.tsx','app/estoque/editar/page.tsx','components/stock/StockBarcodeFinder.tsx','components/layout/PageHeader.tsx','components/NativeRuntime.tsx','app/estoque/compras/page.tsx','types/index.ts'];
for(const path of paths){ const str=fs.readFileSync(path,'utf8');const ast=ts.createSourceFile(path,str,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(!ast.parseDiagnostics.length,`sintaxe ${path}: ${ast.parseDiagnostics.map(x=>x.messageText).join(',')}`); }
const movement=fs.readFileSync('app/estoque/movimentar/page.tsx','utf8');
for(const marker of ['looseMovementPresentation(product)','stockMovementBaseQuantity(typed, conversion','stockExitExceeds(rawAmount, product.current_quantity, product.unit)','await operation;','savingRef.current = true','toast.error(']) ok(movement.includes(marker),'movimento mantém '+marker);
const edit=fs.readFileSync('app/estoque/editar/page.tsx','utf8');
ok(edit.includes('barcode:barcode.trim().toUpperCase()')&&edit.includes('item.barcode?.trim().toUpperCase()'),'cadastro persiste código e bloqueia colisão local');
ok((edit.match(/const presentationIssue=validateCommercialPresentations\(presentations\);/g)||[]).length===1,'cadastro valida apresentação exatamente uma vez');
ok(edit.includes('if(looseUnits.trim() && (!Number.isInteger(Number(looseUnits))'),'validação de unidades avulsas incluída antes da apresentação');
ok(edit.indexOf('const cleanBarcode=barcode.trim().toUpperCase();')<edit.indexOf('const presentationIssue=validateCommercialPresentations(presentations);'),'validar código e unidades antes de salvar');

const scan=fs.readFileSync('components/stock/StockBarcodeFinder.tsx','utf8');
for(const marker of ['navigator.mediaDevices.getUserMedia','getTracks().forEach(track => track.stop())','requestAnimationFrame(scanFrame)','document.visibilityState',"code_128",'BarcodeDetector'])ok(scan.includes(marker),'scanner sob demanda '+marker);
ok(!/setInterval\(/.test(scan),'sem polling periódico contínuo de câmera');
const purchase=fs.readFileSync('app/estoque/compras/page.tsx','utf8');
for(const marker of ['onBack={() => {','dfl:native-back-request',"document.addEventListener('visibilitychange'",'purchaseCommitted.current = true','Deseja realmente sair?',"toast.success('Compra montada.')"] )ok(purchase.includes(marker),'rascunho com guard '+marker);
const runtime=fs.readFileSync('components/NativeRuntime.tsx','utf8');
ok(runtime.includes("new CustomEvent('dfl:native-back-request', { cancelable: true })")&&runtime.includes('if (request.defaultPrevented) return;'),'hardware back cancela rota sem remover dono do listener');
const p=fs.readFileSync('scripts/pre-apk.cjs','utf8');ok(p.includes('scripts/test-v112-r98-dual-units-barcode.cjs'),'registrado no pre-apk');
console.log('R98 DUAL + BARCODE + ANDROID GUARD: '+checks+' contratos e cenários OK');
