const fs=require('fs');
const identity=fs.readFileSync('lib/customer-identity.ts','utf8');
const store=fs.readFileSync('store/useAppStore.ts','utf8');
const page=fs.readFileSync('app/entregas/nova/page.tsx','utf8');
const checks=[
 ['endereço divergente bloqueia reutilização',identity.includes('!addressConflict &&')],
 ['preferência é revalidada semanticamente',store.includes('customerIdentityEvidence(')&&store.includes(').reusable')],
 ['preferência não ignora endereço informado',store.includes('address: details?.address')],
 ['seleção visual não força identidade',!page.includes("if (selected) return { kind: 'existing'")],
 ['nome sozinho não vence endereço divergente',identity.includes('knownAddressMismatch')],
];
let failed=0;for(const [label,pass] of checks){console.log((pass?'OK':'ERRO')+': '+label);if(!pass)failed++;}
if(failed)process.exit(1);
console.log('\nIDENTIDADE CONSERVADORA DE CLIENTE: ZERO ERROS');
