#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const inv=require('./r205-release-inventory.cjs');
const plan=require('./r205-release-plan.cjs');
const verify=require('./r205-verify-manifest.cjs');
let checks=0;function ok(value,label){assert.ok(value,label);checks++;}
function eq(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
function cmd(root,...args){const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error('git '+args.join(' ')+' '+r.stderr);return r.stdout.trim()}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dfl-r205-'));
const root=path.join(temp,'repo'),out=path.join(temp,'evidencias');
const put=(name,content)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content)};
try{
 fs.mkdirSync(root);cmd(root,'init','-q');cmd(root,'config','user.name','Teste');cmd(root,'config','user.email','test@example.invalid');
 put('app/page.tsx','export default function Page(){return null}\n');
 cmd(root,'add','--','app/page.tsx');cmd(root,'commit','-qm','base');
 put('app/page.tsx','export default function Page(){return 1}\n');
 put('components/new.tsx','export function New(){return null}\n');
 put('notes.orig','NAO PUBLICAR');put('security/firestore.rules','allow read, write: if true;');
 put('.env.local','MY_SECRET=secret-not-in-report');
 put('.github/workflows/deploy.yml','name: Test\n');
 put('docs/readme.md','Local doc');
 const captured=plan.run(['--out',out],root);
 eq(captured.selected.length,3,'3 arquivos liberaveis (app, components, docs)');
 ok(captured.selected.some(x=>x.path==='components/new.tsx'),'arquivo novo entra');
 ok(captured.selected.some(x=>x.path==='app/page.tsx'),'arquivo alterado entra');
 ok(captured.selected.every(x=>x.sha256?.length===64),'hash dos candidatos');
 ok(captured.excluded.some(x=>x.path==='notes.orig'),'sobra excluida');
 ok(captured.excluded.some(x=>x.path==='.env.local'),'secreto excluido');
 ok(captured.excluded.some(x=>x.path==='security/firestore.rules'),'rules excluidas');
 ok(captured.excluded.some(x=>x.path==='.github/workflows/deploy.yml'),'workflow exige revisao');
 ok(!fs.readFileSync(path.join(out,'R205-MANIFEST.json'),'utf8').includes('secret-not-in-report'),'sem conteudo de segredo');
 ok(fs.readFileSync(path.join(out,'R205-ALLOWLIST.txt'),'utf8').split('\n').filter(Boolean).length===3,'allowlist somente candidatos');
 ok(!fs.readFileSync(path.join(out,'R205-ALLOWLIST.txt'),'utf8').includes('firestore'),'rules fora da allowlist');
 ok(captured.gate.includes('PENDENTE'),'sem gate verde falso');
 eq(cmd(root,'diff','--cached','--name-only'),'','nenhuma alteracao de stage');
 const stored=JSON.parse(fs.readFileSync(path.join(out,'R205-MANIFEST.json'),'utf8'));
 inv.verify(root,stored);checks++;
 verify.run(['--manifest',path.join(out,'R205-MANIFEST.json')],root);checks++;
 put('app/page.tsx','export default function Page(){return 2}\n');
 assert.throws(()=>inv.verify(root,stored),/DRIFT/);checks++;
 put('app/page.tsx','export default function Page(){return 1}\n');
 put('components/another.tsx','new file\n');
 assert.throws(()=>inv.verify(root,stored),/DRIFT/);checks++;
 fs.unlinkSync(path.join(root,'components/another.tsx'));
 cmd(root,'add','--','app/page.tsx');
 assert.throws(()=>inv.gather(root),/STAGE/);checks++;
 cmd(root,'reset','-q','--','app/page.tsx');
 inv.verify(root,stored);checks++;
 fs.unlinkSync(path.join(root,'app/page.tsx'));
 const deletion=inv.gather(root);
 ok(deletion.removed.some(x=>x.path==='app/page.tsx'),'exclusao fica pendente de revisao');
 assert.throws(()=>inv.verify(root,stored),/DRIFT/);checks++;
 eq(inv.categorize('src/unknown.ts').selected,false,'fora do escopo');
 eq(inv.categorize('lib/x.ts').selected,true,'arquivo de codigo');
 eq(inv.categorize('scripts/test-a.cjs').selected,true,'arquivo de teste');
 eq(inv.categorize('security/a.rules').selected,false,'rules sempre fora');
 eq(inv.categorize('x.env').selected,false,'segredo conservador');
 eq(inv.categorize('components/b.tsx.orig').selected,false,'sobra .orig');
 eq(inv.categorize('.github/workflows/main.yml').selected,false,'workflow revisao');
 eq(inv.categorize('package-lock.json').selected,false,'dependencia revisao');
 eq(inv.safePath('../x'),false,'rejeita traversal');
 eq(inv.safePath('/tmp/x'),false,'rejeita absoluto');
 eq(inv.safePath('lib/a.ts'),true,'aceita caminho valido');
 console.log('R205: '+checks+' contratos aprovados. Release so por autorizacao explicita.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
