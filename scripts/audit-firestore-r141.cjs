#!/usr/bin/env node
'use strict';
// Audita pontos de entrada Firestore sem executar consultas ou imprimir dados de clientes.
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const targets = ['store','hooks','components','app','lib'];
const exclusions = new Set(['node_modules','.next','android','ios','out','dist','build','coverage']);
const operations = ['getDocs','getDoc','onSnapshot','collection','query','runTransaction','writeBatch','setDoc','updateDoc','deleteDoc','addDoc'];
const token = new RegExp('\\b('+operations.join('|')+')\\s*\\(', 'g');
const results = [];
function walk(dir) {
 if (!fs.existsSync(dir)) return;
 for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  if (exclusions.has(entry.name) || entry.name.startsWith('.')) continue;
  const rel=path.join(dir,entry.name);
  if (entry.isDirectory()) {walk(rel);continue;}
  if (!entry.isFile() || !/\.(tsx?|jsx?)$/.test(entry.name)) continue;
  const src=fs.readFileSync(rel,'utf8');
  // Indicador conservador: pontos no código, não fatura ou número exato de leituras.
  const matches=[...src.matchAll(token)];
  if(!matches.length)continue;
  const counts={}; for(const m of matches)counts[m[1]]=(counts[m[1]]||0)+1;
  results.push({file:rel.replace(/\\/g,'/'),counts});
 }
}
for (const t of targets)walk(t);
results.sort((a,b)=>a.file.localeCompare(b.file));
const totals={}; for(const x of results)for(const [k,v] of Object.entries(x.counts))totals[k]=(totals[k]||0)+v;
const directUI=results.filter(x=>/^(app|components)\//.test(x.file) && (x.counts.getDocs || x.counts.getDoc || x.counts.onSnapshot));
const report={version:'R141',generatedAt:new Date().toISOString(),scope:targets,method:'static call-site scan; not billable Firestore reads',totals,filesScannedWithHits:results.length,directUI,results};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else {console.log('R141 — MAPA FIRESTORE (somente leitura)');console.log('Operações:',JSON.stringify(totals));console.log('Arquivos com chamadas:',results.length);console.log('Pontos diretos em UI (revisão manual):',directUI.length);for(const x of directUI)console.log(' -',x.file,JSON.stringify(x.counts));}
