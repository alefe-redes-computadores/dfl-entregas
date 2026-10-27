#!/usr/bin/env node
'use strict';
// R125 - fail-closed static access contracts; read-only; no Firebase credentials.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const roles=read('lib/access/roles.ts');
const repo=read('lib/access/staffRepository.ts');
const panel=read('app/mais/acessos/page.tsx');
const pre=read('scripts/pre-apk.cjs');
const checks=[
 ['Superadmin-only repository guard',/function ensureOwner\(/.test(repo)&&/isSuperadminUid\(uid\)/.test(repo)],
 ['Inactive drafts only',/activation:\s*'not_enabled'/.test(roles)&&/record\.activation\s*!==\s*'not_enabled'/.test(repo)],
 ['No active staff status',/export type StaffStatus\s*=\s*'rascunho'\s*\|\s*'suspenso'/.test(roles)],
 ['Drafts still read as inactive',/item\.activation === 'not_enabled'/.test(repo)],
 ['RBAC prepared does not activate',/Acesso ainda não ativado/.test(panel)],
 ['Zero enabled shown',/Liberados/.test(panel)&&/className="text-xl font-black tabular-nums">0</.test(panel)],
 ['No staff_admin delegation',/permission\s*!==\s*'staff_admin'/.test(repo)],
 ['Role schema checked on save',/STAFF_ROLES\.some\(\(item\) => item\.id === record\.role\)/.test(repo)],
 ['Motoboy binding checked',/validMotoboyBinding\(linkedMotoboyId\)/.test(repo)],
 ['Staff regression gate in pre-APK',pre.includes('scripts/test-r125-staff-safety.cjs')],
 ['Real Firebase emulator test retained',fs.existsSync('scripts/test-v111-r64-rules-emulator.cjs')],
];
let failed=0;
for(const [label,pass] of checks){console.log(`${pass?'OK':'FALHOU'}: ${label}`);if(!pass)failed++;}
assert.equal(failed,0,'R125 security gate blocked');
console.log('R125: contrato de equipe preservado. NÃO comprova regras implantadas nem autoriza login.');
