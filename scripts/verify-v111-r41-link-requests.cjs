#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
let checks=0;function ok(value,message){assert.ok(value,message);checks++}
const read=(x)=>fs.readFileSync(x,'utf8');
const files=['app/api/access/claim/route.ts','lib/access/staffClaimPolicy.ts','lib/access/staffClaimClient.ts','components/access/StaffLinkRequest.tsx','components/auth/AuthGuard.tsx','app/mais/acessos/homologacao/page.tsx','app/rotas/page.tsx','app/entregas/page.tsx'];
for(const file of files){const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(parsed.parseDiagnostics.length===0,file+': TypeScript/JSX invalid');}
const server=read('app/api/access/claim/route.ts');
for(const clause of ['verifyIdToken(header.slice(7), true)','adminAuth.getUser(token.uid)',"token.firebase?.sign_in_provider !== 'google.com'","person.providerData.some(provider => provider.providerId === 'google.com')","process.env.DFL_STAFF_LINK_REQUESTS_ENABLED !== 'true'",'claimOriginAllowed(origin, req.nextUrl.origin)',"where('email', '==', email).limit(2)",'claimableIdentity(person.uid, person.email, person.emailVerified, person.disabled)',"adminDb.collection('staff_link_requests').doc(token.uid)","where('email','==',email.trim().toLowerCase()).limit(10)",'isSuperadminUid(token.uid)',"status:'pending'",'no-store'])ok(server.includes(clause),'Server lost '+clause);
for(const forbidden of ["status:'active'",'batch.set(adminDb.collection(\'staff_accounts\')','getDocs(collection(db','setInterval(','onSnapshot('])ok(!server.includes(forbidden),'Unsafe activation/read introduced: '+forbidden);
const policy=read('lib/access/staffClaimPolicy.ts');
ok(policy.includes('isIsolatedStaffOrigin(origin)'),'Isolated staff origin missing');
ok(policy.includes("value.status !== 'rascunho'"),'Draft state guard');
ok(policy.includes("value.activation !== 'not_enabled'"),'Draft activation guard');
const auth=read('components/auth/AuthGuard.tsx');
ok(auth.includes("process.env.NEXT_PUBLIC_DFL_STAFF_LINK_REQUEST_ENABLED === 'true'"),'Request UI build gate missing');
ok(auth.includes('isIsolatedStaffOrigin(window.location.origin)'),'UI staff origin guard missing');
ok(auth.includes('!Capacitor.isNativePlatform() && <StaffLinkRequest />'),'Native must stay blocked');
const stage=read('app/mais/acessos/homologacao/page.tsx');
ok(stage.includes('fetchStaffLinkClaims(draftId)'),'Owner claim picker missing');
ok(stage.includes('setUid(claim.uid);reset();'),'Owner UID selection missing');
ok(stage.includes("requestStaffStaging(action,draftId,uid.trim()"),'Prior stage verify/preview/stage retained');
const routes=read('app/rotas/page.tsx');ok(routes.includes('sortedAt')&&routes.includes('a.sortedAt - b.sortedAt'),'Routes sort optimization');
const deliveries=read('app/entregas/page.tsx');ok(deliveries.includes('normalizedQuery ? normalize('),'Deliveries search lazy normalize');ok(deliveries.includes('a.sortAt - b.sortAt'),'Deliveries time memoized per row');
const pre=read('scripts/pre-apk.cjs');const list=[...pre.matchAll(/^  '(scripts\/[^']+)',?$/gm)].map(x=>x[1]);
ok(list.length>=164,`R41 required at least 164 suites; found ${list.length}`);ok(new Set(list).size===list.length,'Duplicate suite');
ok(list.includes('scripts/verify-v111-r41-link-requests.cjs')&&list.includes('scripts/test-v111-r41-claim-api.cjs'),'New suites must be mandatory');
console.log('R41 LINK REQUESTS:',checks,'static contracts OK');
