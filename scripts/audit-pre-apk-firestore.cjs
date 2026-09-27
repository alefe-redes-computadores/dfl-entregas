const fs=require('fs'), path=require('path');

const roots=['app','components','hooks','lib'];
const files=[];
function walk(dir){
 if(!fs.existsSync(dir)) return;
 for(const name of fs.readdirSync(dir)){
  const p=path.join(dir,name);
  const st=fs.statSync(p);
  if(st.isDirectory()) walk(p);
  else if(/\.(ts|tsx)$/.test(name)) files.push(p);
 }
}
roots.forEach(walk);

const hits=[];
for(const f of files){
 const s=fs.readFileSync(f,'utf8');
 for(const token of ['getDocs(', 'onSnapshot(']){
  if(s.includes(token)) hits.push({f,token});
 }
}

console.log('Consultas Firestore diretas fora do store:');
if(!hits.length) console.log('  nenhuma');
else hits.forEach(x=>console.log(`  ${x.f}: ${x.token}`));

/*
 * Não falha só por existir consulta especializada legítima.
 * Falha se os hot paths conhecidos passarem a buscar Firestore diretamente.
 */
const hot=[
 'app/page.tsx',
 'app/loja/page.tsx',
 'app/entregas/page.tsx',
 'app/rotas/page.tsx',
 'app/confirmacoes/page.tsx',
 'app/estoque/compras/page.tsx',
];
const bad=[];
for(const f of hot){
 const s=fs.readFileSync(f,'utf8');
 for(const token of ['getDocs(', 'onSnapshot(', 'collection(db']){
  if(s.includes(token)) bad.push(`${f}: ${token}`);
 }
}
if(bad.length){
 console.error('\nREGRESSÃO EM HOT PATH:\n'+bad.join('\n'));
 process.exit(1);
}
console.log('OK: hot paths não consultam Firestore diretamente.');
