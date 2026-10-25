#!/usr/bin/env node
'use strict';
// DFL Surgery 2.0: inventário local e gate por impacto, sem alterar o workspace.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=process.cwd(), args=new Set(process.argv.slice(2));
const mode=args.has('--full')?'full':args.has('--quick')?'quick':'scan';
const now=()=>new Date().toISOString();
const log=(s)=>console.log(`[DFL Surgery] ${s}`);
function git(...a){const p=cp.spawnSync('git',a,{encoding:'utf8',cwd:ROOT,maxBuffer:10*1024*1024});return {ok:p.status===0,text:(p.stdout||'').trim(),error:(p.stderr||'').trim()};}
const exists=p=>fs.existsSync(path.join(ROOT,p));
const normalize=p=>String(p||'').replace(/\\/g,'/').replace(/^\.\//,'');
if(!exists('scripts/pre-apk.cjs')||!exists('package.json')||!exists('.git')){console.error('BLOQUEADO: execute na raiz do dfl-entregas');process.exit(2);}
const reportDir=path.join(ROOT,'.dfl-surgery-reports');fs.mkdirSync(reportDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const reportPath=path.join(reportDir,`R111-${stamp}.json`);
const status=git('status','--porcelain=v1','-uall');if(!status.ok){console.error(status.error);process.exit(2)}
const changed=new Set();const staged=new Set();const untracked=new Set();
for(const line of status.text.split('\n').filter(Boolean)){
  const code=line.slice(0,2);let name=line.slice(3);
  if(name.includes(' -> '))name=name.split(' -> ').at(-1);
  name=normalize(name.replace(/^"|"$/g,''));
  if(!name||name.startsWith('.dfl-surgery-reports/'))continue;
  changed.add(name);if(code==='??')untracked.add(name);if(code[0]!==' '&&code!=='??')staged.add(name);
}
const origin=git('rev-parse','--verify','origin/main');const head=git('rev-parse','HEAD');
const outgoing=origin.ok?git('log','--format=%h %s','origin/main..HEAD'):null;
const incoming=origin.ok?git('log','--format=%h %s','HEAD..origin/main'):null;
const baseline=origin.ok?git('diff','--name-only','origin/main...HEAD'):null;
const files=fs.readdirSync(path.join(ROOT,'scripts')).filter(x=>/\.(?:cjs|mjs|js)$/.test(x));
const pre=fs.readFileSync(path.join(ROOT,'scripts/pre-apk.cjs'),'utf8');
const registered=files.filter(f=>pre.includes(`scripts/${f}`));
const testFiles=registered.filter(f=>/^(?:test|verify|check)[-_.]/.test(f));
const candidates=new Set([...changed,...(baseline?.ok?baseline.text.split('\n').filter(Boolean):[])]);
// Vínculo direto explícito: referências do arquivo afetado no teste, por caminho ou basename.
const scoreTest=(name)=>{
 const txt=fs.readFileSync(path.join(ROOT,'scripts',name),'utf8');let score=0;const causes=[];
 for(const p of candidates){
  if(!/^(app|lib|components|store|types|scripts)\//.test(p))continue;
  const base=path.basename(p).replace(/\.(tsx?|[cm]?js)$/,'');
  if(txt.includes(p)){score+=10;causes.push(p);}
  else if(base.length>=9&&txt.includes(base)){score+=2;causes.push(`~${base}`);}
  if(`scripts/${name}`===p){score+=50;causes.push('alterado');}
 }
 return {name,score,causes:[...new Set(causes)].slice(0,9)};
};
const scored=testFiles.map(scoreTest).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
const limit=Number(process.env.DFL_SURGERY_QUICK_LIMIT||'45');const selected=scored.slice(0,Number.isFinite(limit)&&limit>0?Math.min(limit,200):45);
const report={version:'R111',created_at:now(),mode,head:head.text,origin_main:origin.ok?origin.text:null,outgoing:outgoing?.text||'',incoming:incoming?.text||'',changed:[...changed].sort(),staged:[...staged].sort(),untracked:[...untracked].sort(),remote_diff:baseline?.ok?baseline.text.split('\n').filter(Boolean):[],registered_suites:registered.length,scored_tests:scored.length,quick_selected:selected,quick_truncated:scored.length>selected.length,steps:[],success:null};
const write=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
write();
log(`HEAD ${head.text.slice(0,12)} | origin/main ${origin.ok?origin.text.slice(0,12):'indisponível'}`);
log(`${changed.size} arquivo(s) locais alterados; ${staged.size} em stage; ${untracked.size} não rastreado(s)`);
log(`${report.remote_diff.length} arquivo(s) no diff dos commits locais; ${registered.length} suítes no manifesto`);
log(`${scored.length} suíte(s) com ligação detectada; ${selected.length} na rodada rápida`);
if(outgoing?.text)log(`Commits locais não presentes em origin/main:\n${outgoing.text}`);
if(incoming?.text)log(`Atenção: commits em origin/main ausentes localmente:\n${incoming.text}`);
log(`Relatório: ${reportPath}`);
if(mode==='scan')process.exit(0);
function run(label,cmd,argv){
 log(`Executando ${label}`);const started=Date.now();const f=path.join(reportDir,`R111-${stamp}-${label.replace(/[^a-zA-Z0-9_-]/g,'_')}.log`);
 const fd=fs.openSync(f,'w');let outcome;
 try{outcome=cp.spawnSync(cmd,argv,{cwd:ROOT,stdio:['inherit',fd,fd],timeout:600000});}finally{fs.closeSync(fd)}
 const result={label,status:outcome?.status??null,error:outcome?.error?.message||null,ms:Date.now()-started,log:f};report.steps.push(result);write();
 if(outcome?.status!==0){console.error(`[DFL Surgery] FALHOU: ${label}; log: ${f}`);try{const lines=fs.readFileSync(f,'utf8').split('\n');const marked=lines.findIndex(x=>x.includes('FALHOU:'));const tail=marked>=0?lines.slice(Math.max(0,marked-6),marked+10):lines.slice(-24);console.error(tail.join('\n'));}catch{}return false;}
 log(`OK: ${label} (${Math.round(result.ms/1000)}s)`);return true;
}
for(const item of selected){if(!run(`quick-${item.name}`,process.execPath,[`scripts/${item.name}`])){report.success=false;write();process.exit(1)}}
if(!run('typescript',process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'])){report.success=false;write();process.exit(1)}
if(mode==='full'&&!run('pre-apk',process.execPath,['scripts/pre-apk.cjs'])){report.success=false;write();process.exit(1)}
report.success=true;write();log(`${mode==='full'?'GATE COMPLETO':'GATE RÁPIDO'} APROVADO. Sem commit/push/build.`);
