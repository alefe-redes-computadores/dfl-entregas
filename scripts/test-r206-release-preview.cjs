#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const inv=require('./r205-release-inventory.cjs');
const plan=require('./r205-release-plan.cjs');
const {stagePreview}=require('./r206-simulated-index.cjs');
const review=require('./r206-release-review.cjs');
let checks=0;
function ok(val,msg){assert.ok(val,msg);checks++;}
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function fails(fn,re,msg){assert.throws(fn,re,msg);checks++;}
function git(root,...args){const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error('git failed: '+r.stderr);return r.stdout.trim();}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'r206-cases-'));
const root=path.join(temp,'repo'),base=path.join(temp,'base'),out=path.join(temp,'output');
const put=(file,s)=>{const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
try{
 fs.mkdirSync(root);git(root,'init','-q');git(root,'config','user.name','Teste R206');git(root,'config','user.email','r206@example.invalid');
 put('app/page.tsx','export const a = 1;\n');put('lib/unchanged.ts','export const b = 1;\n');
 git(root,'add','--','app/page.tsx','lib/unchanged.ts');git(root,'commit','-qm','initial');
 put('app/page.tsx','export const a = 2;\n');
 put('components/test.tsx','export const c = 1;\n');
 put('docs/release.md','Documentation\n');
 put('scripts/custom.cjs','const x=1;\n');
 put('security/restrita.rules','allow read, write: if true;\n');
 put('.env.local','SECRET_TEST_DO_NOT_LEAK=true\n');
 put('app/page.tsx.orig','BACKUP\n');
 put('package-lock.json','{}\n');
 const old=plan.run(['--out',base],root);
 eq(old.selected.length,4,'old selected count');
 eq(old.excluded.length,4,'old exclusions');
 ok(old.selected.every(r=>r.sha256?.length===64),'hashes for all selected');
 const baseStage=stagePreview(root,old);
 ok(baseStage.isolatedIndex && baseStage.realIndexUntouched,'stage isolated');
 eq(baseStage.staged.length,4,'exact number of selected paths');
 eq(baseStage.staged.slice().sort(),old.selected.map(r=>r.path).sort(),'exact names');
 eq(git(root,'diff','--cached','--name-only'),'','actual index untouched');
 ok(baseStage.stat.includes('app/page.tsx'),'diff statistics');
 ok(!baseStage.staged.includes('security/restrita.rules'),'rules never staged');
 ok(!baseStage.staged.includes('.env.local'),'secret never staged');
 ok(!baseStage.staged.includes('package-lock.json'),'package lock review separately');
 const initial=review.run(['--manifest',path.join(base,'R205-MANIFEST.json'),'--out',out,'--previous',path.join(base,'R205-MANIFEST.json')],root);
 eq(initial.selectedCount,4,'review candidate count');
 eq(initial.productionGate,'PENDENTE_HOMOLOGACAO_REAL','production gate blocked');
 eq(initial.publicationPerformed,false,'never publishes');
 ok(initial.simulatedStage.realIndexUntouched,'stage never changed');
 ok(fs.existsSync(path.join(out,'R206-RESULTADO.json')),'report JSON created');
 ok(fs.existsSync(path.join(out,'R206-STAGE-SIMULADO.txt')),'preview report created');
 ok(fs.existsSync(path.join(out,'R206-DELTA-R205.txt')),'delta report created');
 ok(fs.existsSync(path.join(out,'R206-CHECKLIST.txt')),'manual checklist created');
 ok(!fs.readFileSync(path.join(out,'R206-RESULTADO.txt'),'utf8').includes('SECRET_TEST_DO_NOT_LEAK'),'no secret contents exposed');
 ok(fs.readFileSync(path.join(out,'R206-CHECKLIST.txt'),'utf8').includes('PENDENTE'),'never auto approve');
 eq(git(root,'diff','--cached','--name-only'),'','stage still clean after run');
 fails(()=>review.run(['--manifest',path.join(base,'R205-MANIFEST.json'),'--out',path.join(root,'output')],root),/fora do repositorio/,'refuse output in repo');
 put('components/test.tsx','export const c = 2;\n');
 fails(()=>stagePreview(root,old),/DRIFT/,'content drift blocked');
 put('components/test.tsx','export const c = 1;\n');
 put('app/extra.tsx','export const extra = true;\n');
 fails(()=>stagePreview(root,old),/DRIFT/,'new path drift blocked');
 const second=plan.run(['--out',path.join(temp,'base2')],root);
 const changes=review.delta(old,second);
 ok(changes.available,'delta available');
 eq(changes.added,['app/extra.tsx'],'delta new path');
 eq(changes.changed.length,0,'unchanged files do not show drift');
 fs.unlinkSync(path.join(root,'app/extra.tsx'));
 git(root,'add','--','app/page.tsx');
 fails(()=>stagePreview(root,old),/stage real/,'preexisting stage blocked');
 git(root,'reset','-q','--','app/page.tsx');
 inv.verify(root,old);checks++;
 fails(()=>review.delta({schema:'legacy',selected:[]},old),/invalido/,'reject invalid prior');
 fails(()=>stagePreview(root,{...old,schema:'other'}),/incompat/,'reject incompatible manifest');
 ok(review.safeOut(root,path.join(temp,'outside'))===path.join(temp,'outside'),'outside output allowed');
 eq(git(root,'diff','--cached','--name-only'),'','user index preserved on all paths');
 console.log('R206: '+checks+' contratos aprovados; preview isolada, manifestos, drift, indice e gates.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
