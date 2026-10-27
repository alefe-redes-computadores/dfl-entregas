'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {classify,buildReport}=require('./release-r126-e14-plan.cjs');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
for(const f of ['.env.local','secrets/service-account.json','android/release.jks'])check(classify(f).status==='BLOCK','secrets never selected '+f);
for(const f of ['security/firestore.v111-r26-candidate.rules','firestore.rules','firebase.json'])check(classify(f).status==='HOLD','rules held '+f);
for(const f of ['lib/store-geocoding.ts','components/home/RouteAccordion.tsx','scripts/test-r126-e12-ifood-index.cjs'])check(classify(f).status==='CANDIDATE','code candidate '+f);
check(classify('package-lock.json').status==='REVIEW','lockfile requires manual review');
const result=buildReport({modified:['lib/store-geocoding.ts','.env.local'],staged:['.env.local'],untracked:['scripts/test-r126-e14-plan.cjs']},'aabbcc');
check(result.files.length===3,'dedupe paths');check(result.counts.blocked===1,'blocked count');check(result.findings.some(x=>x.includes('staged')),'warn pre-staged sensitive');
const s=fs.readFileSync('scripts/pre-apk.cjs','utf8');check(s.includes("'scripts/test-r126-e14-plan.cjs'"),'included in pre-apk');
// Inspeciona os comandos de Git executados, nao texto do checklist Markdown.
const planner=fs.readFileSync('scripts/release-r126-e14-plan.cjs','utf8');
const commands=[...planner.matchAll(/\bgit\(\[\s*['"]([^'"]+)['"]/g)].map(x=>x[1]);
check(commands.length>=4,'git calls inspected');
check(commands.every(x=>['diff','ls-files','branch','rev-parse'].includes(x)),'no git mutations');
check(!/\b(?:execSync|execFileSync)\s*\(/.test(planner),'no hidden exec mutations');
console.log(`R126 E14: ${checks} selective release safeguards OK`);
