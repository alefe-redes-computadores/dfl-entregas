#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path='lib/access/staffClaimPolicy.ts';
const source=fs.readFileSync(path,'utf8');
const transpiled=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
assert.equal(transpiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const sandboxModule={exports:{}};
vm.runInNewContext(transpiled.outputText,{module:sandboxModule,exports:sandboxModule.exports,require:(id)=>{
  if(id==='./roles')return {isSuperadminUid:uid=>uid==='owner'};
  if(id==='./staffOrigin')return {isIsolatedStaffOrigin:origin=>origin==='https://staff.example'};
  if(id==='./staffInvitePolicy')return {requiresMotoboyBinding:role=>role==='motoboy',validMotoboyBinding:v=>typeof v==='string'&&v.length>0};
  throw Error('unrecognized import '+id);
},String,Array,Error,Set,Object},{filename:path});
const p=sandboxModule.exports;
const draft={id:'staff_12345678',role:'compras',email:'user@example.com',status:'rascunho',activation:'not_enabled',permissions:['stock_read']};
const checks=[
 [p.claimableDraft(draft,'user@example.com'),true,'convite normal'],
 [p.claimableDraft(draft,' USER@example.com '),true,'email normalizado'],
 [p.claimableDraft({...draft,email:''},''),false,'email vazio em ambas pontas'],
 [p.claimableDraft({...draft,email:'  '},'  '),false,'email somente espacos'],
 [p.claimableDraft({...draft,email:'invalid'},'invalid'),false,'email malformado'],
 [p.claimableDraft({...draft,email:'a'.repeat(161)+'@x.br'},'a'.repeat(161)+'@x.br'),false,'email excessivo'],
 [p.claimableDraft({...draft,activation:'enabled'},'user@example.com'),false,'ativacao bloqueada'],
 [p.claimableDraft({...draft,role:'motoboy'},'user@example.com'),false,'vinculo motoboy requerido'],
 [p.claimableDraft({...draft,role:'motoboy',linkedMotoboyId:'moto_1'},'user@example.com'),true,'motoboy vinculado apenas claim preparado'],
 [p.claimableIdentity('user_123456','user@example.com',true,false),true,'identidade verificada'],
 [p.claimableIdentity('user_123456','user@example.com',false,false),false,'email nao verificado'],
 [p.claimableIdentity('owner','user@example.com',true,false),false,'dono nao usa convite'],
 [p.claimOriginAllowed('https://staff.example','https://staff.example'),true,'origem isolada'],
 [p.claimOriginAllowed('https://evil.example','https://evil.example'),false,'origem externa'],
];
for(const [actual,expected,label] of checks)assert.equal(actual,expected,label);
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
for(const t of ['test-r125-staff-safety.cjs','test-r125-geocode-cache.cjs','test-r125-e3-resilience.cjs','test-r125-e4-readiness.cjs','test-r125-e5-release.cjs','test-r126-e1-identity.cjs'])assert.ok(pre.includes(t),'missing gate '+t);
assert.ok(source.includes('value.activation !== \'not_enabled\''),'activation must remain off');
console.log('R126 E1: '+(checks.length+7)+' verificacoes aprovadas');
