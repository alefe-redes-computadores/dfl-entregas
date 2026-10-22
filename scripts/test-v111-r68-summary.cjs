const assert=require('node:assert/strict');
const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');
const content=fs.readFileSync('lib/operation/siteInboxSummary.ts','utf8');
const js=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(js,context,{timeout:1000});
const f=context.exports.siteInboxSummary;
assert.equal(f({ready:0,commercial:0,scheduled:0,review:0}),'Nenhum pedido aguardando organização');
assert.equal(f({ready:1,commercial:0,scheduled:0,review:0}),'1 pronto para rota');
assert.equal(f({ready:2,commercial:1,scheduled:0,review:3}),'2 prontos para rota · 1 aguardando o Site · 3 para revisar');
assert.equal(f({ready:0,commercial:0,scheduled:2,review:0}),'2 agendados');
for(let a=0;a<20;a++)for(let b=0;b<20;b++)for(let c=0;c<5;c++){
 const t=f({ready:a,commercial:b,scheduled:c,review:0});
 assert.equal(/\b0 pronto/.test(t),false);assert.equal(/\b0 aguardando/.test(t),false);assert.equal(/\b0 agendado/.test(t),false);
}
console.log('R68 SUMMARY: 6000 + 4 cenarios aprovados');
