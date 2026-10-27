#!/usr/bin/env node
'use strict';
// Static, offline, read-only inventory. No Firebase SDK imports and no environment dumps.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=process.cwd();
const checks=[
 ['inbox-policy','lib/operation/siteInboxPolicy.ts',['siteInboxProjection','assertSiteRouteAllocation']],
 ['identity','lib/customer-identity.ts',['sameCustomerIdentityAddress','customerIdentityEvidence']],
 ['sync-policy','lib/operation/foreground-sync-policy.ts',['shouldRefreshOnForeground']],
 ['staff-boundary','lib/access/staffPortalRepository.ts',['getDocsFromServer','limit(40)','assertIdentity(uid)']],
 ['site-diagnostics','app/api/integration/diagnostics/route.ts',['verifyIdToken']],
 ['inbox-regression','scripts/test-v111-r67-inbox-collisions.cjs',['siteInboxProjection']],
 ['identity-regression','scripts/test-v112-r84-customer-identity.cjs',['customerIdentityEvidence']],
 ['sync-regression','scripts/test-v112-r91-sync-resilience.cjs',['shouldRefreshOnForeground']],
 ['security-regression','scripts/test-r126-e3-staff-boundary.cjs',['STAFF_AREAS']]
];
const results=[];let failed=0;
for(const [name,file,needles] of checks){
 const loc=path.resolve(root,file);
 if(!loc.startsWith(root+path.sep)||!fs.existsSync(loc)){console.error('FAIL missing '+file);failed++;continue;}
 const src=fs.readFileSync(loc,'utf8');
 const absent=needles.filter(n=>!src.includes(n));
 if(absent.length){console.error('FAIL contract '+file+': '+absent.join(','));failed++;}
 else console.log('OK contract '+name);
 results.push({name,file,sha256:crypto.createHash('sha256').update(src).digest('hex'),bytes:Buffer.byteLength(src),verified:absent.length===0});
}
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
for(const name of ['scripts/test-v111-r67-inbox-collisions.cjs','scripts/test-v112-r84-customer-identity.cjs','scripts/test-v112-r91-sync-resilience.cjs','scripts/test-r126-e3-staff-boundary.cjs','scripts/test-r126-e4-integration-gate.cjs']){
 if(!pre.includes("'"+name+"'")){console.error('FAIL pre-apk missing '+name);failed++;}
}
const output={phase:'R126-E4',timestamp:new Date().toISOString(),scope:'offline local source only',productionRulesVerified:false,liveFirebaseQueried:false,staffActivationAuthorized:false,files:results,failures:failed};
if(process.argv.includes('--json')){const i=process.argv.indexOf('--json');const out=process.argv[i+1];if(!out||out.startsWith('-'))throw Error('provide output filepath');fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Report: '+out);}
console.log('R126-E4 AUDIT:',results.length,'files,',failed,'failures; production Firestore rules UNVERIFIED');
if(failed)process.exitCode=1;
