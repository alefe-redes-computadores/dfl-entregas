#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = process.cwd();
const originalResolve = Module._resolveFilename;
const originalTS = Module._extensions['.ts'];
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) return originalResolve.call(this, path.join(root, request.slice(2)) + '.ts', parent, isMain, options);
  return originalResolve.call(this, request, parent, isMain, options);
};
Module._extensions['.ts'] = function(mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }});
  assert.equal((transpiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `TypeScript ${filename}`);
  mod._compile(transpiled.outputText, filename);
};
// O teste deve funcionar no Node/Termux sem carregar a bridge Android.
const previousLoad = Module._load;
const nativeShareCalls = [];
const nativeWriteCalls = [];
Module._load = function(request, parent, isMain) {
  if (request === '@capacitor/core') return { Capacitor: { isNativePlatform: () => true } };
  if (request === '@capacitor/filesystem') return { Directory: { Cache: 'CACHE' }, Filesystem: {
    writeFile: async (args) => { nativeWriteCalls.push(args); return { uri: 'file:///cache/' + args.path }; }
  } };
  if (request === '@capacitor/share') return { Share: { share: async (args) => { nativeShareCalls.push(args); } } };
  return previousLoad.call(this, request, parent, isMain);
};
let checks = 0;
const ok = (value, description) => { assert.ok(value, description); checks++; console.log('OK R96:', description); };
try {
  for (const name of ['lib/stock-market-list.ts', 'lib/stock-market-pdf.ts', 'app/estoque/compras/page.tsx']) {
    const contents = fs.readFileSync(name, 'utf8');
    const parsed = ts.createSourceFile(name, contents, ts.ScriptTarget.Latest, true, name.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    ok(parsed.parseDiagnostics.length === 0, `TS/TSX válido: ${name}`);
  }
  const market = require('../lib/stock-market-list.ts');
  const pdf = require('../lib/stock-market-pdf.ts');
  const goods = [
    {id:'cheese',name:'Mussarela',active:true,unit:'kg',category:'Frios',presentations:[{id:'p500',active:true,label:'500 g',purchase_unit:'pct',conversion_quantity:0.5}]},
    {id:'box',name:'Caixa de embalagem',active:true,unit:'un',category:'Embalagens',presentations:[{id:'cx24',active:true,label:'caixa com 24 un',purchase_unit:'cx',conversion_quantity:24}]},
    {id:'milk',name:'Leite',active:true,unit:'l',category:'Mercearia'},
  ];
  const args=[goods,{cheese:true,box:true,milk:false},{cheese:'3',box:'2',milk:'9'},{cheese:'p500',box:'cx24'}];
  const first=market.buildStockMarketRows(...args);
  ok(first.invalid.length===0 && first.rows.length===2,'somente escolhidos válidos entram na lista');
  const cheese=first.rows.find(x=>x.productId==='cheese');
  const box=first.rows.find(x=>x.productId==='box');
  ok(cheese.supplyItem.quantity===1.5 && cheese.supplyItem.purchase_quantity===3,'pacote de 500 g converte corretamente para 1,5 kg');
  ok(box.supplyItem.quantity===48 && box.supplyItem.purchase_quantity===2,'2 caixas de 24 un equivalem a 48 unidades');
  ok(cheese.purchaseText.includes('3') && box.purchaseText.includes('2'),'quantidades comerciais legíveis');
  ok(first.rows[0].category==='Frios'&&first.rows[1].category==='Embalagens','lista agrupada por categoria canônica');
  const malformed=market.buildStockMarketRows(goods,{cheese:true,box:true},{cheese:'',box:'-4'},args[3]);
  ok(malformed.rows.length===0 && malformed.invalid.length===2,'quantidade inválida bloqueia exportação sem omitir silenciosamente');
  const purchased={[cheese.id]:cheese.signature};
  ok(market.stockMarketChecked(cheese,purchased)&&!market.stockMarketChecked(box,purchased),'checklist valida assinatura por produto');
  const json=market.serializeStockMarketChecks(first.rows,purchased,new Date('2026-10-24T09:00:00Z'));
  ok(market.readStockMarketChecks(json,first.rows,Date.parse('2026-10-24T09:10:00Z'))[cheese.id]===cheese.signature,'checklist recuperado offline');
  ok(Object.keys(market.readStockMarketChecks(json,first.rows,Date.parse('2026-11-15T09:10:00Z'))).length===0,'checklist antigo expira');
  ok(Object.keys(market.readStockMarketChecks('{erro',first.rows)).length===0,'JSON corrompido seguro');
  const changed=market.buildStockMarketRows(goods,args[1],{cheese:'4',box:'2',milk:'9'},args[3]);
  ok(Object.keys(market.readStockMarketChecks(json,changed.rows,Date.parse('2026-10-24T09:10:00Z'))).length===0,'mudança de quantidade reabre conferência');
  const text=market.stockMarketText(first.rows,purchased,new Date('2026-10-24T09:00:00Z'));
  ok(text.includes('[x] Mussarela') && text.includes('[ ] Caixa de embalagem'),'texto editável conserva conclusão individual');
  ok(text.indexOf('FRIOS')<text.indexOf('EMBALAGENS'),'texto para Samsung Notes conserva grupos');
  const payload=pdf.buildStockMarketPdf(first.rows,purchased,new Date('2026-10-24T09:00:00Z'));
  ok(payload.startsWith('%PDF-1.4')&&payload.includes('/Type /Pages')&&payload.includes('xref'),'PDF A4 válido com índices');
  ok(payload.includes('Mussarela') && payload.includes('Caixa de embalagem'),'PDF inclui todos os produtos');
  const bulk=Array.from({length:90},(_,i)=>({...cheese,id:`i${i}`,name:`Produto ${i}`,signature:`rev${i}`}));
  const multipage=pdf.buildStockMarketPdf(bulk,{});
  ok(multipage.includes('/Count 3') || multipage.includes('/Count 4') || multipage.includes('/Count 5') || multipage.includes('/Count 6'), 'PDF pagina sem cortar produtos em lista grande');
  const page=fs.readFileSync('app/estoque/compras/page.tsx','utf8');
  ok(page.includes('exportStockMarketPdf(marketPreview.rows, marketChecked)'),'PDF nativo integrado ao rascunho real');
  ok(page.includes('void Haptics.impact({ style }).catch(() => undefined)'),'feedback tátil não bloqueia operação');
  ok(page.includes('marketExportLock.current = true') && page.includes('marketExportLock.current = false'),'duplo toque no PDF isolado');
  ok(page.includes('aria-valuenow={marketPurchased}') && page.includes('aria-expanded={marketExpanded}'),'progresso acessível e checklist recolhível');
  ok(page.includes('marketStorageWarning') && page.includes('Não foi possível guardar o checklist'),'falha de cache avisada sem interromper a compra');
  const pdfSource = fs.readFileSync('lib/stock-market-pdf.ts','utf8');
  ok(pdfSource.includes('Directory.Cache') && pdfSource.includes('Filesystem.writeFile') && pdfSource.includes('files: [saved.uri]'),'PDF nativo via Cache/FileProvider/Share');
  ok(!pdfSource.includes('getDocs(') && !pdfSource.includes('setDoc('),'PDF não toca Firestore');
  ok(page.includes('Share.share({') && page.includes('navigator.clipboard.writeText(text)') && page.includes("document.execCommand('copy')"),'Android share + cópia para notas');
  ok(page.includes('localStorage.removeItem(STOCK_PURCHASE_DRAFT_KEY)')&&page.includes('localStorage.removeItem(STOCK_MARKET_CHECKLIST_KEY)'),'rascunhos limpos somente depois da compra confirmada');
  const savedAt=page.indexOf('await addStockSupply(supply);');
  const clearedAt=page.indexOf('localStorage.removeItem(STOCK_MARKET_CHECKLIST_KEY)');
  const successAt=page.indexOf("toast.success('Compra montada.');",savedAt);
  ok(savedAt>=0 && clearedAt>savedAt && successAt>clearedAt,'limpeza acontece após gravação e antes do feedback de sucesso');
  ok(!fs.readFileSync('lib/stock-market-list.ts','utf8').match(/getDocs\(|setDoc\(|updateDoc\(|onSnapshot\(/),'cálculo puro sem nova leitura ou gravação Firestore');
  const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
  ok(pre.includes('scripts/test-v112-r96-market-list.cjs'),'gate global registra a R96');
  console.log(`R96 LISTA DE MERCADO: ${checks} verificações aprovadas`);
} finally {
  Module._resolveFilename = originalResolve;
  Module._load = previousLoad;
  if (originalTS) Module._extensions['.ts']=originalTS;
  else delete Module._extensions['.ts'];
}

// Verificação nativa real, com FileSystem/Share falsos e sem ponte Android.
(async () => {
  const pdf = require('../lib/stock-market-pdf.ts');
  const before = { id:'item-a', name:'Produto A', category:'Mercearia', purchaseText:'2 pacotes', signature:'v1' };
  const mode = await pdf.exportStockMarketPdf([before], {});
  assert.equal(mode, 'shared');
  assert.equal(nativeWriteCalls.length, 1);
  assert.equal(nativeWriteCalls[0].directory, 'CACHE');
  assert.ok(nativeWriteCalls[0].data.startsWith('JVBERi0'));
  assert.equal(nativeShareCalls.length, 1);
  assert.equal(nativeShareCalls[0].files.length, 1);
  console.log('OK R96: PDF nativo compartilhável sem download por blob URL');
})().catch(error => { console.error(error); process.exitCode = 1; });
