#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('node:module');
let n=0;
const ok=(v,label)=>{assert.ok(v,`R88 ${label}`);console.log('OK:',label);n++;};
function load(file,deps={}){
 const input=fs.readFileSync(file,'utf8');
 const out=ts.transpileModule(input,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const m=new Module(file,module);
 m.filename=process.cwd()+'/'+file;
 m.require=(p)=>{if(Object.hasOwn(deps,p))return deps[p];throw Error('Unexpected dependency: '+p)};
 m._compile(out.outputText,m.filename);
 return m.exports;
}
const sorter=load('lib/motoboy-route-order.ts').settlementRouteOrder;
const a=[{label:'Rota 10',orderCount:2},{label:'Rota 2',orderCount:3},{label:'Rota 1',orderCount:4}];
const b=sorter(a);
ok(b.map(x=>x.label).join(',')==='Rota 1,Rota 2,Rota 10','rota 1, 2, 10 ordenadas naturalmente');
ok(a[0].label==='Rota 10','ordenacao nao muta fontes financeiras');
ok(b[0].orderCount===4 && b[1].orderCount===3,'contagens nao migraram entre rotas');
ok(sorter([{label:'Rota 04'},{label:'Rota 3'}])[0].label==='Rota 3','rotas com zero a esquerda ordenadas');
const classifier=load('lib/operation/home-exceptions.ts',{
 '@/lib/maps':{extractLatLngFromMapsUrl:value=>String(value||'').includes('lat=')?{lat:1,lng:2}:null},
}).classifyHomeExceptions;
const pending=[
 {id:'semRota',route_id:'',address_string:''},
 {id:'quebrada',route_id:'desconhecida',address_string:''},
 {id:'resgatado',route_id:'ok',customer_id:'c1',address_string:''},
 {id:'semEndereco',route_id:'ok',address_string:''},
 {id:'semNumero',route_id:'ok',address_string:'Rua Joao'},
 {id:'gps',route_id:'ok',maps_link:'lat=1',address_string:'Rua Sem Numero'},
 {id:'comNumero',route_id:'ok',address_string:'Rua Verde 35'},
];
const c=classifier(pending,[{id:'c1',address:'Rua Bom Jesus, 50'}],new Set(['ok']));
ok(c.unassigned.length===1 && c.unassigned[0].id==='semRota','sem rota vem antes de endereco');
ok(c.corruptLinks.length===1 && c.corruptLinks[0].id==='quebrada','vinculo invalido isolado');
ok(c.noAddress.length===1 && c.noAddress[0].id==='semEndereco','endereco realmente ausente');
ok(c.addressOnly.length===1 && c.addressOnly[0].id==='semNumero','localizacao sem numero orienta revisao');
ok(!c.noAddress.some(x=>x.id==='resgatado'),'endereco do cliente evita alerta falso');
ok(!c.addressOnly.some(x=>x.id==='gps'),'evidencia GPS evita alerta falso');
ok(c.unassigned.length+c.corruptLinks.length+c.noAddress.length+c.addressOnly.length===4,'pendencia unica por pedido');
const read=f=>fs.readFileSync(f,'utf8');
const home=read('components/home/OperationalCommandCenter.tsx');
const header=read('components/layout/Header.tsx');
const settle=read('app/motoboys/acerto/page.tsx');
const card=read('lib/route-share-card.ts');
const pre=read('scripts/pre-apk.cjs');
ok(home.includes("key: 'unassigned-route'")&&home.includes('deliveryActionHref(unassigned[0])'),'home acao direta para entrega sem rota');
ok(home.includes('classifyHomeExceptions(pending, customers, allRouteIds)'),'home classifica sem varreduras duplicadas');
ok(home.includes('siteInboxProjection(allDeliveries)') && home.includes('count: routeCodes.missing'),'inbox e iFood preservados');
ok(header.includes('Falha na atualização · Tentar novamente')&&header.includes('refreshNow(true)'),'erro de sync com nova tentativa');
ok(!header.includes('Offline / Erro'),'erro temporario nao se passa por offline');
ok(settle.includes('settlementRouteOrder(data.routeBreakdown)')&&settle.includes('settlementEquation'),'acerto ordenado sem alterar calculo');
ok(card.includes('IFOOD  /  MOTOBOY CONFIRMA')&&card.includes('IFOOD  /  LOJA CONFIRMA'),'imagem segue responsabilidade do motoboy');
ok(card.includes('ifoodVisibleOrders.forEach')&&card.includes('CODIGO: ${codeLabel}')&&card.includes('ID: ${idLabel}'),'imagem lista IDs e codigos individuais');
ok(card.includes('driverConfirmsIfood ?')&&card.includes('confirmacao-entrega-propria.ifood.com.br'),'portal na imagem so para motoboy');
ok(card.includes('ifoodPanelHeight + 34'),'imagem reserva area dinamica');
ok(card.includes('driverConfirmsIfood ? 128 : 0') && card.includes('Codigo salvo no DFL NAO confirma no portal'),'R85: reserva de 128px usada para orientacoes reais de confirmacao');
ok(home.includes('!extractLatLngFromMapsUrl(delivery.maps_link)') && home.includes('!/\\b\\d{1,5}\\b/'),'R77: numero e coordenadas continuam validados');
ok(pre.includes('scripts/test-v112-r88-home-settlement.cjs'),'teste incluido no preapk');
for(const file of ['components/home/OperationalCommandCenter.tsx','components/layout/Header.tsx','app/motoboys/acerto/page.tsx','lib/route-share-card.ts']){
 const doc=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(doc.parseDiagnostics.length===0,`TSX de ${file}`);
}
console.log(`R88: ${n} contratos comportamentais e estruturais aprovados`);
