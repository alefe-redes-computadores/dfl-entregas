const fs=require('fs');
const targets=[
 'app/confirmar/page.tsx',
 'app/confirmacoes/page.tsx',
 'app/rotas/nova/page.tsx',
 'app/rotas/editar/page.tsx',
 'components/routes/RouteDepartureChecklist.tsx',
 'lib/route-cash-flow.ts',
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
console.log('HOT PATH V3C: nenhuma leitura Firestore direta.');
