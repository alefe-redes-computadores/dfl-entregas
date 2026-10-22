#!/usr/bin/env node
'use strict';
/** Diagnóstico estático conservador — caminhos e CONTAGENS apenas; sem dados nem rede. */
const fs=require('node:fs');const path=require('node:path');
const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6);
const routeFiles=fs.readdirSync('app/api/access').filter(x=>fs.existsSync(`app/api/access/${x}/route.ts`)).sort();
const uiFiles=fs.readdirSync('app/mais/acessos',{withFileTypes:true}).filter(x=>x.isDirectory()&&fs.existsSync(`app/mais/acessos/${x.name}/page.tsx`)).map(x=>x.name).sort();
const report=['DFL V111 R37 — INVENTARIO TECNICO LOCAL (SEM LIBERACAO)','STATUS: PREPARACAO; EMULATOR PENDENTE DE LOG REAL','FONTE: SNAPSHOT R36 + R37, NENHUM CONTATO COM FIRESTORE',''];
let issues=0;
for(const name of routeFiles){const file=`app/api/access/${name}/route.ts`,s=fs.readFileSync(file,'utf8');
 const bounded=(s.match(/\.limit\s*\(/g)||[]).length;
 const dynamic=(s.match(/\.collection\s*\(/g)||[]).length;
 const auth=/verifyIdToken\(/.test(s)&&/isSuperadminUid\(/.test(s);
 const poll=/onSnapshot\s*\(|setInterval\s*\(/.test(s);
 const flags=(s.match(/DFL_STAFF_[A-Z_]+_ENABLED/g)||[]).length;
 const problems=[];if(!auth)problems.push('REVISAR AUTENTICACAO');if(poll)problems.push('POLLING');
 const reads=(s.match(/\.get\s*\(/g)||[]).length;
 if(dynamic>0&&reads>0&&bounded===0&&!/\.doc\(/.test(s))problems.push('REVISAR CONSULTA SEM LIMITE');
 issues+=problems.length;
 report.push(`${file}: collections=${dynamic}, limits=${bounded}, reads=${reads}, flags=${flags}, owner=${auth?'sim':'REVISAR'}, ${problems.join(' / ')||'sem alerta sintatico'}`);
}
report.push('',`PAGINAS STAFF (incluindo gate R37): ${uiFiles.length}`);
report.push(...uiFiles.map(x=>`app/mais/acessos/${x}/page.tsx`));
report.push('','ATENCAO: limite estatistico nao prova custo real, especialmente consultas transacionais e leituras por UID.');
report.push('Acao adicional: homologar Firebase Emulator real e revisar CI, Rules LIVE, performance e identidade antes de qualquer publicacao.');
report.push(`Alertas heuristicos (podem requerer revisao, nao aprovam a release): ${issues}`);
report.push('NAO foi executado: commit, push, deploy, migracao, Rule deploy, liberacao de funcionarios.');
const txt=report.join('\n')+'\n';if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,txt);}process.stdout.write(txt);
