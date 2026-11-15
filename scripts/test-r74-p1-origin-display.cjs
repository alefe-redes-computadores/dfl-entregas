'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path='lib/tracking/gate1/core.ts';
const src=fs.readFileSync(path,'utf8');
const ast=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(ast.parseDiagnostics.length,0,'AST válido');
const line=src.split('\n').find(x=>x.includes('const origin_label ='));
assert.ok(line,'projeção de origem localizada');
const expr=line.match(/const origin_label\s*=\s*([^;]+);/);
assert.ok(expr,'expressão pura de origem');
const display=new Function('source','origin','return ('+expr[1]+')');
for(const [source,origin,want] of [['dfl_site','loja','Site'],['manual','loja','Loja'],['','ifood','iFood'],['','food99','99Food'],['','keeta','Keeta'],['','x','Loja']])assert.equal(display(source,origin),want);
const compiled=ts.transpileModule(src,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',compiled)(mod,mod.exports);
assert.equal(typeof mod.exports.mayIssueNewTrackingGrant,'function','gate de emissao ativo');
for(const origin of ['ifood','food99','keeta']){
  const base={id:'dfl-test-123456789012',source_system:'dfl_entregas',origin,
    fulfillment_mode:'delivery',logistics_provider:'dfl',notify_whatsapp:true,
    manual_messaging_opt_in_v1:true,completed:false};
  assert.equal(mod.exports.mayIssueNewTrackingGrant({...base,manual_messaging_opt_in_v1:false}),false,origin+' sem consentimento bloqueado');
  assert.equal(mod.exports.mayIssueNewTrackingGrant({...base,notify_whatsapp:false}),false,origin+' opt-out bloqueado');
  assert.equal(mod.exports.mayIssueNewTrackingGrant({...base,fulfillment_mode:'external_delivery',logistics_provider:origin}),false,origin+' plataforma entrega bloqueada');
  assert.equal(mod.exports.mayIssueNewTrackingGrant({...base,completed:true}),false,origin+' concluido bloqueado');
  assert.equal(mod.exports.mayIssueNewTrackingGrant(base),true,origin+' autorizado e rota DFL');
}
assert.ok(src.includes('mayIssueNewTrackingGrant'),'sem substituir autoridade de emissão');
assert.ok(fs.readFileSync('scripts/pre-apk.cjs','utf8').includes("'scripts/test-r74-p1-origin-display.cjs'"),'suite no gate global');
console.log('R74 ENT P1: 6 projeções + 3 contratos de segurança aprovados');
