const fs=require('fs'), path=require('path');
const roots=['app','components'];
const files=[];
function walk(d){
 if(!fs.existsSync(d)) return;
 for(const n of fs.readdirSync(d)){
  const p=path.join(d,n), st=fs.statSync(p);
  if(st.isDirectory()) walk(p);
  else if(/\.(tsx|ts)$/.test(n)) files.push(p);
 }
}
roots.forEach(walk);
const back=[];
for(const f of files){
 const s=fs.readFileSync(f,'utf8');
 if(s.includes('router.back()')) back.push(f);
}
console.log(`router.back() encontrados: ${back.length}`);
back.slice(0,40).forEach(f=>console.log('  '+f));
console.log('INFO: não é erro por si só; fluxos críticos devem preferir destino canônico.');
