const {spawnSync}=require('child_process');
const fs=require('fs');

const tests=[
  'scripts/verify-delivery-inbox-money-v9.cjs',
  'scripts/verify-pre-apk-stability-v8.cjs',
  'scripts/verify-customer-identity-conservative-v18.cjs',
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
  'scripts/verify-motoboy-settlement-carry-v10.cjs',
  'scripts/verify-site-route-experience-v11.cjs',
  'scripts/verify-route-reorder-v13-3.cjs',
  'scripts/verify-route-grouping-v18-1.cjs',
  'scripts/verify-route-reactive-order-v24-4.cjs',
  'scripts/verify-operational-modal-polish-v19.cjs',
  'scripts/verify-grouped-stop-completion-v20.cjs',
  'scripts/verify-route-money-v13-4.cjs',
  'scripts/verify-ifood-refresh-v13-5.cjs',
  'scripts/test-v17-5-auto-fastlane-next-stop.cjs',
  'scripts/test-v17-6-native-route-kick.cjs',
  'scripts/verify-stock-operation-recovery-v2.cjs',
  'scripts/verify-v16-integrated.cjs',
  'scripts/verify-v16-macrosurgery.cjs',
  'scripts/verify-v16-1-commercial-presentations.cjs',
  'scripts/verify-v16-2-stock-experience.cjs',
  'scripts/verify-v16-stock-display-polish.cjs',
  'scripts/verify-stock-movement-flow-v21.cjs',
  'scripts/verify-stock-movement-clarity-v21-1.cjs',
  'scripts/audit-delivery-inbox-firestore.cjs',
  'scripts/audit-operation-ifood-routes-firestore.cjs',
  'scripts/audit-intelligence-routes-v2.cjs',
  'scripts/verify-native-admin-launcher-v22.cjs',
  'scripts/verify-final-integration-polish-v23.cjs',
  'scripts/verify-site-integration-observability-v24.cjs',
  'scripts/verify-toast-sync-hotfix-v24-1.cjs',
  'scripts/verify-action-semantics-v24-2.cjs',
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
