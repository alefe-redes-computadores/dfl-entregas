#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');const vm=require('node:vm');
function load(path){const src=fs.readFileSync(path,'utf8');const out=ts.transpileModule(src,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});assert.equal((out.diagnostics||[]).filter(x=>x.category===1).length,0);const module={exports:{}};vm.runInNewContext(out.outputText,{module,exports:module.exports,Set,Map,Array,String,Object,Error},{filename:path});return module.exports;}
const roles=load('lib/access/roles.ts');
const check=(role,input,expected)=>{const got=Array.from(roles.restrictStaffDraftPermissions(role,input));assert.deepEqual(got,expected,`${role}: ${JSON.stringify(input)}`)};
check('motoboy',['finance','staff_admin','routes_read','deliveries_complete','stock_write'],['routes_read','deliveries_complete']);
check('compras',['purchases_write','finance','stock_read','routes_read'],['purchases_write','stock_read']);
check('operacao',['routes_read','stock_read','settings','reports'],['routes_read','stock_read']);
check('personalizado',['home','finance','staff_admin','diagnostics','home','deliveries_read'],['home','finance','diagnostics','deliveries_read']);
check('motoboy','routes_read',[]);check('invalid_role',['home'],[]);check('motoboy',['home','home','deliveries_complete'],['home','deliveries_complete']);
const repo=fs.readFileSync('lib/access/staffRepository.ts','utf8');assert.match(repo,/restrictStaffDraftPermissions\(record\.role,\s*sanitizePermissions\(record\.permissions\)\)/);assert.match(repo,/permission\s*!==\s*'staff_admin'/);assert.match(repo,/record\.activation\s*!==\s*'not_enabled'/);assert.match(repo,/ensureOwner\(\)/);const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');assert(pre.includes('scripts/test-r126-e2-least-privilege.cjs'));for(const name of ['test-r125-staff-safety.cjs','test-r125-e5-release.cjs','test-r126-e1-identity.cjs'])assert(pre.includes(name));console.log('R126 E2: 15 verificacoes de minimo privilegio e regressao aprovadas; funcionarios continuam INATIVOS.');
