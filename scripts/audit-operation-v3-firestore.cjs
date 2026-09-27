const fs=require('fs');
const targets=[
 'app/entregas/nova/page.tsx',
 'app/confirmacoes/page.tsx',
 'lib/motoboy-analytics.ts',
 'lib/customer-identity.ts',
 'lib/whatsapp.ts',
];
let failed=0;
for(const file of targets){
 const s=fs.readFileSync(file,'utf8');
 const bad=/\bgetDocs\s*\(|\bonSnapshot\s*\(|\bgetDoc\s*\(/.test(s);
 console.log(`${bad?'ERRO':'OK'}: ${file}${bad?' introduziu leitura Firestore direta':''}`);
 if(bad)failed++;
}
if(failed)process.exit(1);
console.log('HOT PATH V3: nenhuma leitura Firestore direta nova.');
