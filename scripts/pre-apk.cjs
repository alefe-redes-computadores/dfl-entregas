const {spawnSync}=require('child_process');
const fs=require('fs');

const tests=[
  'scripts/verify-delivery-inbox-money-v9.cjs',
  'scripts/verify-pre-apk-stability-v8.cjs',
  'scripts/verify-operacao-v8a.cjs',
  'scripts/test-operacao-v8b-parser.cjs',
  'scripts/verify-operacao-v8b.cjs',
  'scripts/verify-delivery-inbox-v1.cjs',
  'scripts/verify-operation-ifood-routes-v1.cjs',
  'scripts/verify-operation-v3-final.cjs',
  'scripts/verify-operation-v3c-final.cjs',
  'scripts/verify-super-operacao-v1b.cjs',
  'scripts/verify-super-operacao-v2.cjs',
  'scripts/verify-route-notifications-v3.cjs',
  'scripts/verify-motoboy-settlement-semantics-final.cjs',
  'scripts/verify-stock-operation-recovery-v2.cjs',
  'scripts/audit-delivery-inbox-firestore.cjs',
  'scripts/audit-operation-ifood-routes-firestore.cjs',
  'scripts/audit-intelligence-routes-v2.cjs',
].filter(fs.existsSync);

let failed=0;
for(const file of tests){
  console.log(`\n===== ${file} =====`);
  const r=spawnSync(process.execPath,[file],{stdio:'inherit'});
  if(r.status!==0){ failed++; console.error(`FALHOU: ${file}`); }
}
if(failed){
  console.error(`\nPRE-APK BLOQUEADO: ${failed} suíte(s) falharam.`);
  process.exit(1);
}
console.log(`\nPRE-APK: ${tests.length} suítes concluídas sem erro.`);
