'use strict';
// V111 R20: impedir build quebrado por 'use client' após imports/expressões.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const roots=['app','components','hooks','store'];
const extensions=/\.(?:js|jsx|ts|tsx)$/;
const directive=/^[ \t]*(?:'use client'|"use client")[ \t]*;?[ \t]*$/gm;
const broken=[];
let checked=0,clients=0;
function firstRealStatement(src){
 let pos=0;
 if(src.charCodeAt(0)===0xFEFF)pos++;
 while(pos<src.length){
  const ws=/\s/y;ws.lastIndex=pos;const w=ws.exec(src);if(w){pos=ws.lastIndex;continue;}
  if(src.startsWith('//',pos)){const end=src.indexOf('\n',pos+2);pos=end<0?src.length:end+1;continue;}
  if(src.startsWith('/*',pos)){const end=src.indexOf('*/',pos+2);if(end<0)return src.slice(pos);pos=end+2;continue;}
  break;
 }
 return src.slice(pos);
}
function examine(file){
 const src=fs.readFileSync(file,'utf8');
 const directives=[...src.matchAll(directive)];
 checked++;
 if(directives.length){
  clients++;
  if(directives.length!==1 || !/^(?:'use client'|"use client")[ \t]*;?(?:\s|$)/.test(firstRealStatement(src))){broken.push(file);}
 }
}
function walk(dir){
 if(!fs.existsSync(dir))return;
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);
  if(item.isDirectory()){if(!['node_modules','.next','dist','build'].includes(item.name))walk(file);}
  else if(item.isFile()&&extensions.test(item.name))examine(file);
 }
}
for(const root of roots)walk(root);
for(const file of ['app/estoque/novo/page.tsx','app/estoque/editar/page.tsx']){
 assert.ok(fs.existsSync(file),`Arquivo crítico ausente: ${file}`);
 const body=fs.readFileSync(file,'utf8');
 assert.ok(body.startsWith("'use client';\n"),`Diretiva não está no início: ${file}`);
 assert.ok(body.includes("import { validateCommercialPresentations, cleanCommercialPresentations } from '@/lib/stock-presentation-integrity';"),`Importação perdida: ${file}`);
}
assert.deepEqual(broken,[],`Diretivas 'use client' fora do início: ${broken.join(', ')}`);
console.log(`R20 BUILD: ${checked} arquivos verificados; ${clients} Client Components íntegros; 2 páginas corrigidas.`);
