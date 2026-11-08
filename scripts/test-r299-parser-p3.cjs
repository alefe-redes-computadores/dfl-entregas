#!/usr/bin/env node
'use strict';
/** R299 P3: regressão executável, sem rede/Firestore/pedidos reais. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let count=0;
const check=(label,condition)=>{assert.ok(condition,`R299 P3: ${label}`);count++;console.log('OK R299 P3:',label)};
const equal=(label,actual,expected)=>{assert.equal(actual,expected,`R299 P3: ${label}`);count++;console.log('OK R299 P3:',label)};
const read=p=>fs.readFileSync(p,'utf8');
const load=(path,stubs={})=>{
 const out=ts.transpileModule(read(path),{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 check('transpilar '+path,!out.diagnostics?.some(item=>item.category===ts.DiagnosticCategory.Error));
 const mod={exports:{}};
 const localRequire=id=>{if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];throw new Error('Import externo não autorizado em '+path+': '+id)};
 new Function('require','module','exports',out.outputText)(localRequire,mod,mod.exports);
 return mod.exports;
};
for(const path of [
 'lib/operation/beverage-normalization.ts','lib/operation/marketplace-text-parser.ts',
 'lib/integration/site-order.ts','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx'
]){
 const kind=path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
 const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,kind);
 check('AST '+path+': '+(ast.parseDiagnostics[0]?.messageText||''),ast.parseDiagnostics.length===0);
}
const b=load('lib/operation/beverage-normalization.ts');
const drinks=b.parseBeverageTokens;
equal('combo não vira bebida inteira',JSON.stringify(drinks('3 Trem + 1 Fanta 1L')),'[{"name":"FANTA 1L","qty":1}]');
equal('uma bebida em três formatos vira a mesma chave',JSON.stringify(b.normalizeBeverageList(['FANTA 1L','Fanta 1 L','1 Fanta 1 litro'])),'["3x FANTA 1L"]');
equal('Coca Zero não vira Coca normal',JSON.stringify(drinks('2 Coca Zero 2 litros')),'[{"name":"COCA ZERO 2L","qty":2}]');
equal('Coca-Cola canônica',drinks('Coca-Cola 2 L')[0]?.name,'COCA 2L');
equal('separador de bebidas reais',JSON.stringify(drinks('2 Fanta 1L, 1 Coca 2L')),'[{"name":"FANTA 1L","qty":2},{"name":"COCA 2L","qty":1}]');
equal('segmento que não é bebida não inventa consumo',drinks('3 Trem + 2 Armaria').length,0);
equal('bebida manual desconhecida não desaparece',JSON.stringify(b.normalizeBeverageList(['Outra bebida especial'])),'["Outra bebida especial"]');
const site=load('lib/integration/site-order.ts',{
 './contracts':{INTEGRATION_SCHEMA_VERSION:1,isIntegrationEventEnvelope:()=>true},
 './site-combo-unit-guard':{legacySiteOrderCanPreserveContent:()=>true},
 '@/lib/operation/beverage-normalization':b,
});
const siteDrinks=site.siteOrderDrinksFromPayload;
equal('Site extrai apenas refrigerante do combo',siteDrinks([{id:'combo',name:'3 Trem + 1 Fanta 1L',quantity:1}]),'1x FANTA 1L');
equal('Site não duplica componente que já aparece no nome',siteDrinks([{name:'3 Trem + 1 Fanta 1 L',quantity:1,components:[{name:'Fanta 1 litro',quantity:1}]}]),'1x FANTA 1L');
equal('Site respeita multiplicação de combo',siteDrinks([{name:'3 Trem + 1 Fanta 1L',quantity:2}]),'2x FANTA 1L');
equal('Site contabiliza duas bebidas diferentes',siteDrinks([{name:'3 Trem + 1 Fanta 1L',quantity:1,components:[{name:'Coca Zero 2L',quantity:1}]}]),'1x FANTA 1L, 1x COCA ZERO 2L');
equal('Site agrega grafias de mesma bebida',siteDrinks([{name:'Fanta 1L',category:'Bebidas',quantity:1},{name:'Fanta 1 litro',category:'bebidas',quantity:1}]),'2x FANTA 1L');
equal('Site preserva categoria bebida desconhecida',siteDrinks([{name:'Bebida Artesanal 500ml',category:'Bebidas',quantity:1}]),'1x Bebida Artesanal 500ml');
equal('Site não inventa refrigerante sem evidência',siteDrinks([{name:'3 Trem',quantity:1}]),'');
const stubIfood={orderId:'2255',ifoodId:'75400962',confirmationCode:'',customerName:'Joao',drinks:[],value:'',customerCharge:''};
const m=load('lib/operation/marketplace-text-parser.ts',{
 '@/lib/ifood-order-parser':{parseIfoodOrderText:()=>stubIfood},
 '@/lib/keeta-order':{parseKeetaOrdersText:()=>[{orderId:'K-777',ifoodId:'',confirmationCode:'',customerName:'Maria',drinks:[]}]},
 '@/lib/food99-order':{normalizeFood99Order:(_,base)=>({...base,orderId:'123456',ifoodId:'',confirmationCode:''})},
});
equal('editor iFood preserva ID iFood',m.parseMarketplaceText('ifood','pedido').ifoodId,'75400962');
equal('editor Keeta não herda ID iFood',m.parseMarketplaceText('keeta','pedido').ifoodId,'');
equal('editor 99Food não herda ID iFood',m.parseMarketplaceText('food99','pedido').ifoodId,'');
equal('editor não interpreta origem Loja como marketplace',m.parseMarketplaceText('loja','pedido'),null);
equal('editor ignora vazio',m.parseMarketplaceText('ifood','   '),null);
const novo=read('app/entregas/nova/page.tsx'),edita=read('app/entregas/editar/page.tsx');
for(const marker of [
 "origin !== 'loja' && (",'parseMarketplaceText(origin, magicText)',
 "if (origin === 'ifood' && parsed.ifoodId)", "if (origin === 'ifood' && parsed.confirmationCode)",
 "origin==='keeta'?'border-violet-500/25", "origin==='food99'?'border-amber-400/25",
 'marketplacePreview?.customerName','useDeferredValue(magicText)',
 'normalizeBeverageList(parsed.drinks)', 'Configurações avançadas · indicadores',
])check('editar preserva '+marker,edita.includes(marker));
for(const marker of [
 'normalizeBeverageList(item.drinks)',"isKeeta ? 'border-violet-400/25",'Configurações avançadas · pedido de teste',
 'Configurações avançadas · métricas do cliente','ownerIdentityAmongDrafts && <section',
 'if (isKeeta) setKeetaPaymentReviewed(false)',
])check('novo preserva '+marker,novo.includes(marker));
check('Gate P1 e P2 mantidos',read('scripts/pre-apk.cjs').includes('test-r299-core-p1.cjs')&&read('scripts/pre-apk.cjs').includes('test-r299-clientes-p2.cjs'));
check('Gate P3 registrado',read('scripts/pre-apk.cjs').includes('test-r299-parser-p3.cjs'));
check('Sem chamadas remotas novas em utilitários',!/\b(fetch|setDoc|getDocs|onSnapshot|runTransaction)\s*\(/.test(read('lib/operation/beverage-normalization.ts')+read('lib/operation/marketplace-text-parser.ts')));
console.log(`R299 P3 APROVADA: ${count} verificacoes comportamentais e estruturais, sem rede.`);
