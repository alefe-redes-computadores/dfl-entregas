#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const path=require('node:path'),os=require('node:os');
let count=0;function ok(value,label){assert.ok(value,`R204: ${label}`);count++;console.log('OK R204:',label);}
const helper='lib/access/release-readiness.ts';
const view='app/mais/acessos/publicacao/page.tsx';
const parent='app/mais/acessos/page.tsx';
const source=fs.readFileSync(helper,'utf8');
for(const file of [helper,view,parent]){const node=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(node.parseDiagnostics.length===0,'sintaxe '+file);}
const js=ts.transpileModule(source,{fileName:helper,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const compiledExports={};vm.runInNewContext(js,{exports:compiledExports,Set,Array,Object},{filename:helper});
const {RELEASE_CHECKS,assessReleaseReadiness,releaseChecklistText}=compiledExports;
ok(RELEASE_CHECKS.length===7,'sete cenarios operacionais obrigatorios');
ok(new Set(RELEASE_CHECKS.map(s=>s.id)).size===RELEASE_CHECKS.length,'checks possuem IDs unicos');
ok(RELEASE_CHECKS.every(s=>s.title&&s.detail),'cada check tem orientacao');
ok(assessReleaseReadiness([]).status==='PENDENTE_EVIDENCIA','sem evidencias nunca aprova');
ok(assessReleaseReadiness([], 'bloqueado').status==='BLOQUEADO','regras inseguras bloqueiam');
ok(assessReleaseReadiness([], 'owner_only_verificado').status==='PENDENTE_EVIDENCIA','rules nao substituem teste real');
const ids=RELEASE_CHECKS.map(s=>s.id);
ok(assessReleaseReadiness(ids,'pendente').status==='PENDENTE_EVIDENCIA','marcar tudo sem rules nao libera');
ok(assessReleaseReadiness(ids,'bloqueado').status==='BLOQUEADO','bloqueio tem precedencia');
ok(assessReleaseReadiness(ids,'owner_only_verificado').status==='PRONTO_PARA_REVISAO','todas declaracoes so levam a revisao');
ok(assessReleaseReadiness([...ids,ids[0]],'owner_only_verificado').done===7,'marcacao duplicada nao conta duas vezes');
ok(assessReleaseReadiness(ids.slice(0,-1),'owner_only_verificado').missing.length===1,'pendencia humana mantida');
ok(releaseChecklistText([], 'pendente').includes('NAO E CERTIFICADO'),'texto copiado nao se apresenta como certificado');
ok(releaseChecklistText(ids, 'pendente').includes('Nao publicar'),'proibicao de publicacao sem autorizacao');
const ui=fs.readFileSync(view,'utf8'),nav=fs.readFileSync(parent,'utf8'),pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
ok(ui.includes('isSuperadminUid(uid)'),'interface exige owner');
ok(ui.includes('if (!isOwner) return'),'rejeicao de outros perfis');
ok(ui.includes("assessReleaseReadiness(checked, 'pendente')"),'rules pendentes nao podem ser marcadas na UI');
ok(ui.includes('releaseChecklistText(checked, \'pendente\')'),'copiar nao forja regras');
ok(ui.includes('type="checkbox"')&&ui.includes('aria-label='),'acessibilidade do checklist');
ok(!/\b(?:getDocs|getDoc|onSnapshot|runTransaction|setDoc|fetch)\s*\(/.test(ui),'tela sem consultas ou mutacoes Firebase');
ok(!/localStorage|sessionStorage/.test(ui),'checklist da sessao nao persiste conclusao enganosa');
ok(nav.includes("router.push('/mais/acessos/publicacao')"),'central de equipe oferece acesso');
ok(pre.includes("'scripts/test-r204-release-readiness.cjs'"),'R204 no pre-APK');
ok(pre.includes("'scripts/test-r203-rules-production.cjs'"),'R203 preservada');
ok(pre.includes("'scripts/test-r202-legacy-import-audit.cjs'"),'R202 preservada');
const cli='scripts/r204-release-evidence.cjs';
const cliText=fs.readFileSync(cli,'utf8');
ok(!/firebase-admin|firebase\/firestore|\.delete\(|setDoc\(|batch\.commit\(/.test(cliText),'auditoria CLI sem mutacoes Firebase');
ok(cliText.includes('PENDENTE_HOMOLOGACAO_REAL'),'CLI nunca declara deploy liberado');
const audit=require(path.resolve(cli));
const missing=audit.rulesEvidence(null,null);
ok(missing.status==='PENDENTE','sem arquivo nao atesta rules');
const fake=path.join(os.tmpdir(),`dfl-r204-rules-${process.pid}.json`);
const build=(props)=>JSON.stringify({production:{project:'projeto-teste',source:'firebase-rules-rest-api',sourceVerified:true,status:'OWNER_ONLY_VERIFICADO',checkedAt:new Date().toISOString(),sha256:'a'.repeat(64),rulesetName:'projects/projeto-teste/rulesets/r1',releaseName:'projects/projeto-teste/releases/cloud.firestore',...props}});
try{
 fs.writeFileSync(fake,build({}),{mode:0o600});
 ok(audit.rulesEvidence(fake,'projeto-teste').status==='EVIDENCIA_DECLARADA','atestacao coerente continua declarativa');
 ok(audit.rulesEvidence(fake,'outro-projeto').status==='PENDENTE','troca de projeto recusada');
 fs.writeFileSync(fake,build({source:'arquivo-local'}));ok(audit.rulesEvidence(fake,'projeto-teste').status==='PENDENTE','fonte local nao passa');
 fs.writeFileSync(fake,build({status:'BLOQUEADO'}));ok(audit.rulesEvidence(fake,'projeto-teste').status==='PENDENTE','rules bloqueadas nao aparecem verdes');
 fs.writeFileSync(fake,build({checkedAt:'2020-01-01T00:00:00.000Z'}));ok(audit.rulesEvidence(fake,'projeto-teste').status==='PENDENTE','prova antiga recusada');
 fs.writeFileSync(fake,build({sha256:'invalido'}));ok(audit.rulesEvidence(fake,'projeto-teste').status==='PENDENTE','hash malformado recusado');
}finally{try{fs.unlinkSync(fake);}catch{}}
console.log(`R204: ${count} contratos aprovados`);
