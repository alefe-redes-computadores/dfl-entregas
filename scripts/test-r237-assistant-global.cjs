'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const read = p => fs.readFileSync(p, 'utf8');
const signal = read('lib/operation/assistant-signal-priority.ts');
const js = ts.transpileModule(signal, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
const sandbox = {module: {exports: {}}, exports: {}};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(js, sandbox);
const { chooseContextualSignal, assistantSignalPriority } = sandbox.module.exports;
const info = (id,title,tone='amber') => ({id,title,message:'1 registro exige conferência',action:'Revisar',target:'revisar',tone});
assert.equal(chooseContextualSignal([], new Set()), null);
assert.equal(chooseContextualSignal([info('r235:routes:street:2026-11-03','Rotas na rua','sky')],new Set()),null, 'leitura rotineira não precisa ocupar a tela');
const a = info('routine', 'Compras abertas','sky');
const b = info('invalido', 'Quantidades inválidas');
const c = info('revisar', 'Pedidos do Site para revisão');
assert.equal(chooseContextualSignal([a,b,c],new Set()).id, b.id, 'urgência supera a ordem da lista');
assert.equal(chooseContextualSignal([a,b,c],new Set([b.id])).id, c.id, 'dispensa é respeitada');
assert.equal(chooseContextualSignal([a,b,c],new Set([b.id,c.id])).id, a.id, 'fallback de evidência');
assert.equal(chooseContextualSignal([a,b,c],new Set([a.id,b.id,c.id])),null);
assert.ok(assistantSignalPriority(b)>assistantSignalPriority(a));
const global=read('components/assistant/GlobalAssistantPalette.tsx');
const header=read('components/layout/Header.tsx');
const home=read('components/home/OperationalAssistant.tsx');
const context=read('components/assistant/ContextualAssistantCard.tsx');
const css=read('app/globals.css');
for (const part of ['role="dialog"','aria-modal="true"','role="search"','useDeferredValue','searchAssistantSnapshot','assistantDestinations','assistantShortcutByCommand','onClose();','router.push(href)','privacy ? []','document.body.style.overflow','prefers-reduced-motion']) {
  assert.ok((global+css).includes(part),`Busca global perdeu ${part}`);
}
assert.ok(header.includes('GlobalAssistantPalette') && header.includes('Ctrl+K') && header.includes('Abrir Busca 360'));
assert.ok(home.includes('insightOptions.find(option => !hiddenIds.has(option.id))'),'dispensa Home não alterna evidência');
assert.ok(context.includes('chooseContextualSignal(signals, hiddenIds)'), 'prioridade não integrada');
assert.ok(!global.includes('fetch(') && !global.includes('addDoc(') && !global.includes('getDocs('),'Busca global não pode ler/escrever rede');
assert.ok(!global.includes('localStorage.setItem('),'não persistir pesquisa ou PII');
for(const path of ['components/assistant/GlobalAssistantPalette.tsx','components/layout/Header.tsx','components/home/OperationalAssistant.tsx','components/assistant/ContextualAssistantCard.tsx']){
  const source=read(path);const result=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2020}});
  assert.equal((result.diagnostics||[]).length,0,`TSX parse: ${path}`);
}
console.log('R237: prioridade, supressão, busca global, segurança, UI premium e TSX parse OK');
