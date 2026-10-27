#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {ALLOW}=require('./release-r126-e15-selective.cjs');
const {classify}=require('./release-r126-e14-plan.cjs');
assert.equal(new Set(ALLOW).size,ALLOW.length);
for(const p of ALLOW){assert.equal(classify(p).status,'CANDIDATE',p);assert(!/^(security\/|\.env|firebase\.json|firestore\.rules)/.test(p),p);assert(!/\.\./.test(p),p);assert(!/\.(?:orig|bak|backup|rej)$/.test(p),p)}
for(const p of ['lib/access/roles.ts','lib/access/staffRepository.ts','scripts/pre-apk.cjs','scripts/test-r126-e12-ifood-index.cjs'])assert(ALLOW.includes(p));
const s=fs.readFileSync('scripts/release-r126-e15-selective.cjs','utf8');
assert(s.includes('heldForReview') && s.includes('REVIEW_HOLD') && s.includes('BACKUP_FILE'),'omission list must be explicit');
assert(!/execSync\(\s*['"`]git add -A/.test(s));
assert(!/spawnSync\(\s*['"`]git['"`],\s*\[['"`](?:add|push|commit|reset)/.test(s));
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
assert(pre.includes("'scripts/test-r126-e15-selective.cjs'"),'release gate registered');
console.log('R126 E15: allow-list, no security rules, gate and read-only plan validated');
