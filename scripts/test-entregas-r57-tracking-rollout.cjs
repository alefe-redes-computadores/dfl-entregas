#!/usr/bin/env node
'use strict';const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const src=fs.readFileSync('lib/tracking/gate6/auto-server.ts','utf8');let n=0;const ok=(v,msg)=>{assert.ok(v,'R57 ENT '+msg);n++};
ok(ts.createSourceFile('auto-server.ts',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS).parseDiagnostics.length===0,'TS AST valido');
const found=src.match(/function r311PilotRecipient\(phone:string\):boolean \{[\s\S]*?\n\}/);
ok(Boolean(found),'guard privado presente');
const scopeSrc=found[0].replace('function r311PilotRecipient','function r311PilotRecipient');
const compiled=ts.transpileModule(scopeSrc+'\nexports.guard=r311PilotRecipient;', {fileName:'scope.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const env={DFL_TRACKING_AUTO_PILOT_PHONE_E164:'+5534999999999'},p={env},x={exports:{}};
const run=(changes,phone)=>{
 const newEnv={...env,...changes};return new Function('exports','process',compiled)(x.exports,{env:newEnv}),x.exports.guard(phone);
};
ok(run({},'+5534999999999'),'canario aceita piloto');
ok(!run({},'+5534988888888'),'canario bloqueia externo');
const general={DFL_TRACKING_AUTO_SCOPE:'consented_customers',DFL_TRACKING_AUTO_ROLLOUT_APPROVED:'true'};
ok(run(general,'+5534988888888'),'geral autoriza outro numero valido');
ok(!run({...general,DFL_TRACKING_AUTO_ROLLOUT_APPROVED:'false'},'+5534988888888'),'geral bloqueado sem dupla aprovacao');
for(const val of ['',null,'5534988888888','+5534999','+55349999999990'])ok(!run(general,val),'destinatario invalido negado');
ok(src.includes('parseSiteAcceptance(p.data)')&&src.includes('consent_granted:true'),'aceite consentido preservado');
ok(src.includes('!r311PilotRecipient(recipient)')&&src.includes('if(receiptDoc.exists)return conflict()'),'guarda dupla e idempotencia preservadas');
ok(src.includes('verifyTrackingAutomaticRequest(req,raw)')&&src.includes("mode==='AUTOMATIC_CERTIFIED'")===false,'HMAC preservado; capability validada no modulo');
ok(!src.includes('sendWhatsApp')&&!src.includes('console.log'),'nao envia diretamente nem vaza token');
console.log('R57 ENT: '+n+' contratos de escopo e isolamento aprovados. ZERO envio.');
