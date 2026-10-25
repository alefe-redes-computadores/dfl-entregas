#!/usr/bin/env node
'use strict';
// Complemento conservador R114; nao substitui o Surgery 2.0.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=process.cwd();
if(!fs.existsSync('scripts/pre-apk.cjs')||!fs.existsSync('.git')){console.error('R114: execute na raiz do projeto');process.exit(2)}
const argv=new Set(process.argv.slice(2));const mode=argv.has('--full')?'full':argv.has('--quick')?'quick':'scan';
const out=path.resolve(process.env.DFL_SURGERY_REPORT_DIR||path.join(process.env.HOME||ROOT,'storage/downloads/dfl-entregas-backups'));
fs.mkdirSync(out,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const prefix=path.join(out,'R114-'+stamp);
const git=(...args)=>{const v=cp.spawnSync('git',args,{encoding:'utf8',maxBuffer:32e6});if(v.status!==0)throw Error('git '+args.join(' ')+': '+(v.stderr||v.status));return v.stdout.trim()};
function norm(s){return s.replace(/\\/g,'/').replace(/^\.\//,'')}
let tracked=[],untracked=[],staged=[];
try{const buf=cp.spawnSync('git',['status','--porcelain=v1','-z','-uall'],{encoding:'buffer',maxBuffer:32e6});if(buf.status!==0)throw Error('status git');const a=buf.stdout.toString('utf8').split('\0');for(let i=0;i<a.length;i++){const row=a[i];if(!row)continue;const status=row.slice(0,2),file=norm(row.slice(3));if(status[0]==='R'||status[0]==='C')i++;if(file.startsWith('.dfl-surgery-reports/'))continue;if(status==='??')untracked.push(file);else tracked.push(file);if(status[0]!==' '&&status!=='??')staged.push(file)}}catch(e){console.error(e.message);process.exit(2)}
let remoteDiff=[];let remoteKnown=true;try{git('rev-parse','--verify','origin/main');remoteDiff=git('diff','--name-only','origin/main...HEAD').split('\n').filter(Boolean)}catch{remoteKnown=false}
const impact=[...new Set([...tracked,...untracked,...remoteDiff])].filter(p=>/^(app|lib|components|store|types|scripts|hooks|firebase|public)\//.test(p));
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');const names=[...pre.matchAll(/['"](scripts\/(?:test|verify|check)[^'"\n]+\.[cm]?js)['"]/g)].map(m=>m[1]).filter(p=>fs.existsSync(p));
const unique=[...new Set(names)];const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const reasons=[];
const globalPattern=/^(types\/|store\/|firebase\/|scripts\/pre-apk|lib\/delivery-finance|lib\/route-cash-flow|lib\/motoboy-analytics|lib\/integration\/|app\/api\/|lib\/sync)/;
for(const p of impact){if(globalPattern.test(p))reasons.push('ALTO IMPACTO: '+p)}
if(!remoteKnown)reasons.push('origin/main ausente (referencia remota incerta)');
if(impact.some(p=>p.startsWith('scripts/')&&!/\.(?:test|check|verify)/.test(path.basename(p))&&p!=='scripts/dfl-surgery-21.cjs'))reasons.push('mudanca na infraestrutura de scripts');
const content=new Map(unique.map(p=>[p,fs.readFileSync(p,'utf8')]));const selected=[];const unmatched=[];
for(const p of impact){if(p.startsWith('scripts/')&&unique.includes(p)){selected.push(p);continue}const base=path.basename(p).replace(/\.(?:tsx?|[cm]?js)$/,'');const hits=unique.filter(test=>content.get(test).includes(p)||base.length>8&&content.get(test).includes(base));if(!hits.length&&/^(app|lib|components|store|types|hooks|firebase)\//.test(p))unmatched.push(p);selected.push(...hits)}
if(unmatched.length)reasons.push('DEPENDENCIAS NAO MAPEADAS: '+unmatched.length+' arquivo(s)');
const tests=[...new Set(selected)].sort();const conservative=reasons.length>0||tests.length>80;
const report={version:'R114',mode,time:new Date().toISOString(),head:git('rev-parse','HEAD'),remoteKnown,changed:tracked,untracked,staged,remoteDiff,impact,registered:unique.length,impactTests:tests,unknown:unmatched,reasons,conservative,hashes:Object.fromEntries(impact.filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile()).map(p=>[p,digest(p)])),steps:[],success:null};
function save(){fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n');const lines=[`DFL SURGERY 2.1 | ${mode.toUpperCase()}`,`HEAD ${report.head}`,`Alterados ${tracked.length} | novos ${untracked.length} | stage ${staged.length}`,`Suítes ${unique.length} | impacto ${tests.length}`,`Risco conservador: ${conservative?'SIM':'nao'}`,...reasons.map(x=>'! '+x),'',...tests.map(x=>'TESTE '+x),'','Nota: hashes documentam o estado; nao autorizam sobrescrever alteracoes concorrentes.'];fs.writeFileSync(prefix+'.txt',lines.join('\n')+'\n')}
save();console.log(fs.readFileSync(prefix+'.txt','utf8').split('\n').slice(0,15).join('\n'));console.log('Relatorio: '+prefix+'.json');
if(mode==='scan')process.exit(0);
function run(name,cmd,args){const file=prefix+'-'+name+'.log';console.log('EXECUTANDO '+name);const fd=fs.openSync(file,'w');let p;try{p=cp.spawnSync(cmd,args,{stdio:['inherit',fd,fd],timeout:900000,maxBuffer:32e6})}finally{fs.closeSync(fd)}const ok=p.status===0;report.steps.push({name,ok,code:p.status,error:p.error?.message||null,log:file});save();if(!ok){const lines=fs.readFileSync(file,'utf8').split('\n');const ix=lines.findIndex(x=>x.includes('FALHOU:'));console.error('FALHOU '+name+' | '+file);console.error((ix>=0?lines.slice(Math.max(0,ix-6),ix+10):lines.slice(-30)).join('\n'))}return ok}
// Impacto incerto: executar o gate completo diretamente, evitando rodar 251 testes duas vezes.
const direct=mode==='full'||conservative;
if(!direct){for(const t of tests){if(!run(path.basename(t),process.execPath,[t])){report.success=false;save();process.exit(1)}}}
if(!run('typescript',process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'])){report.success=false;save();process.exit(1)}
if(direct&&!run('pre-apk',process.execPath,['scripts/pre-apk.cjs'])){report.success=false;save();process.exit(1)}
report.success=true;save();console.log('R114 GATE '+(direct?'COMPLETO':'IMPACTO')+' APROVADO; sem commit, push ou build.');
