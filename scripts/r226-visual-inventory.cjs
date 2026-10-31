#!/usr/bin/env node
'use strict';
/** Auditoria determinística e SOMENTE LEITURA. Inspeciona possíveis overlays legados. */
const fs=require('node:fs'),path=require('node:path');
const folders=['app','components'];const result=[];
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='node_modules'||ent.name.startsWith('.'))continue;
    const f=path.join(dir,ent.name);
    if(ent.isDirectory())walk(f);
    else if(/\.tsx$/.test(f)){
      const src=fs.readFileSync(f,'utf8'),lines=src.split('\n');
      for(let i=0;i<lines.length;i++)if(/fixed inset-0|fixed inset-x-0|role="dialog"|aria-modal="true"/.test(lines[i])){
        const text=lines[i];if(!/fixed inset|aria-modal/.test(text))continue;
        result.push({file:f,line:i+1,hasPortal:src.includes('createPortal('),hasDynamicViewport:/100dvh|92dvh|88dvh|calc\(100dvh/.test(src),hasSafeArea:/safe-bottom|safe-area-inset-bottom/.test(src)});
      }
    }
  }
}
folders.forEach(walk);
const uniq=[...new Set(result.map(r=>r.file))];
const flagged=uniq.filter(f=>{
 const s=fs.readFileSync(f,'utf8');
 return /fixed inset-0/.test(s)&&(!s.includes('createPortal(')||!/100dvh|92dvh|88dvh|safe-bottom|safe-area-inset-bottom/.test(s));
});
console.log('DFL R226 — inventário visual somente leitura');
console.log(`Componentes/telas com overlay ou diálogo: ${uniq.length}; entradas auditadas: ${result.length}`);
console.log(`Arquivos candidatos para revisão visual em APK (não são falhas automáticas): ${flagged.length}`);
for(const f of flagged.slice(0,45))console.log('REVISAR_VISUAL:',f);
console.log('Não acessou Firebase, não alterou arquivos, nenhum status falso de aprovação visual.');
