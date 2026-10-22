#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const p=path=>fs.readFileSync(path,'utf8');let n=0;
const check=(value,message)=>{assert.ok(value,message);n++};
const files=['app/api/access/claim/route.ts','scripts/test-v111-r41-claim-api.cjs','scripts/test-v111-r64-rules-emulator.cjs'];
for(const file of files){const src=p(file);if(file.endsWith('.ts'))check(ts.createSourceFile(file,src,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS).parseDiagnostics.length===0,'TypeScript source parsable');else check(src.length>500,'Nonempty test '+file)}
const route=p('app/api/access/claim/route.ts');
for(const phrase of ['adminDb.runTransaction(async tx =>','const freshDraft = await tx.get(draftRef)','const account = await tx.get(accountRef)','const old = await tx.get(ref)',"return 'invitation_changed'","'already_resolved' as const","'already_pending' as const","tx.create(ref,", "status:'pending'", "token.firebase?.sign_in_provider !== 'google.com'", "person.providerData.some(provider => provider.providerId === 'google.com')", "claimOriginAllowed(origin, req.nextUrl.origin)", "process.env.DFL_STAFF_LINK_REQUESTS_ENABLED !== 'true'"]){check(route.includes(phrase),'Claim invariant '+phrase)}
check(route.indexOf('const freshDraft = await tx.get(draftRef)')<route.indexOf('tx.create(ref,'),'Draft verified before write');
check(route.indexOf('const account = await tx.get(accountRef)')<route.indexOf('tx.create(ref,'),'Account verified before write');
check(route.indexOf('const old = await tx.get(ref)')<route.indexOf('tx.create(ref,'),'Prior request verified before write');
check(!/await ref\.set\(/.test(route),'No nonatomic claim set');
check(!/\bstaff_accounts['"]\)\.doc\([^)]*\)\.set\(/.test(route),'No activation');
for(const name of ['firebase.r43-emulator.json','firebase.r44-owner-only-emulator.json','security/firestore.v111-r26-candidate.rules','security/firestore.v111-r23-owner-only.rules'])check(fs.existsSync(name),'Rules artifact preserved '+name);
const workflow=p('.github/workflows/dfl-r64-staff-emulator.yml');
for(const segment of ['workflow_dispatch','demo-dfl-entregas-r43','demo-dfl-entregas-r44-owner','test-v111-r64-rules-emulator.cjs','test-v111-r44-owner-only-emulator.cjs', 'firebase emulators:exec'])check(workflow.includes(segment),'Manual emulator action '+segment);
check(!/\bfirebase deploy\b|\bvercel deploy\b|\bgit push\b/.test(workflow),'No production deploy in action');
const pr=p('scripts/pre-apk.cjs');const suites=[...pr.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
check(suites.length>=210,'R64 >=210 mandatory suites');check(new Set(suites).size===suites.length,'No duplicate suites');
for(const name of ['scripts/verify-v111-r64-claim-atomicity.cjs','scripts/test-v111-r64-claim-races.cjs','scripts/verify-v111-r63-staff-workflows.cjs'])check(suites.includes(name),'Test mandatory '+name);
console.log('R64 CLAIM ATOMICITY:',n,'structural guards OK');
