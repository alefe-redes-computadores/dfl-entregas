#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const a=require('./audit-r126-e13-release.cjs');
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};
for(const p of ['scripts/pre-apk.cjs','lib/operation/ifood-self-confirm-route.ts','components/home/RouteAccordion.tsx'])ok(a.safePath(p),'safe '+p);
for(const p of ['/etc/passwd','../.env','.hidden/../../file','foo\0bar'])ok(!a.safePath(p),'unsafe '+p);
for(const p of ['.env.local','credentials.json','signing.keystore','foo.pem'])ok(a.candidateClassification(p)==='SENSIVEL_NAO_PUBLICAR','secret '+p);
for(const p of ['security/firestore.v111-r26-candidate.rules','firestore.rules','firebase.json'])ok(a.candidateClassification(p)==='REGRAS_CONFERIR_SEPARADO','rules '+p);
ok(a.candidateClassification('components/home/RouteAccordion.tsx')==='CODIGO_AVALIAR','code categorized');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
for(const p of a.REQUIRED.filter(x=>x.startsWith('scripts/test-')))ok(pre.includes(`'${p}'`),'preserved gate '+p);
ok(pre.includes("'scripts/test-r126-e13-release.cjs'"),'new gate');
ok(!pre.includes('git add -A'),'no add all in preapk');
console.log('R126 E13 RELEASE INVENTORY:',n,'contratos OK (sem publicacao)');
