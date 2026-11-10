#!/usr/bin/env node
'use strict';
/** R311: valida funil piloto; o teste R299 valida fluxo idempotente completo. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const path='lib/tracking/gate6/auto-server.ts';
const source=fs.readFileSync(path,'utf8');
const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let count=0;const ok=(x,name)=>{assert.ok(x,'R311 '+name);count++;};
ok(ast.parseDiagnostics.length===0,'AST sem erro');
ok(source.includes("process.env.DFL_TRACKING_AUTO_PILOT_PHONE_E164"),'flag isolada server-only');
ok(source.includes("function r311PilotRecipient(phone:string):boolean"),'guard server-only');
ok(source.includes('if(!phone||!recipient||phone!==recipient||!r311PilotRecipient(recipient))'),'aceite confere o piloto');
ok(source.includes('if(!recipient||!r311PilotRecipient(recipient)||canonicalE164'),'emissao confere o piloto');
ok(source.indexOf('!r311PilotRecipient(recipient)')<source.indexOf("const recipientHash=privateHash('recipient'"),'bloqueia antes de persistir aceite');
ok(source.indexOf('if(!recipient||!r311PilotRecipient')<source.indexOf("const recipientHash=privateHash('recipient'",source.indexOf('export async function issueInitial')),'bloqueia antes de criar grant');
ok(source.includes('verifyTrackingAutomaticRequest(req,raw)'),'HMAC e nonce preservados');
ok(source.includes("if(receiptDoc.exists)return conflict()"),'idempotencia preservada');
ok(source.includes("issued.state!=='issued'"),'unico grant');
ok(!source.includes('sendWhatsApp')&&!source.includes('console.log'),'nao envia e nao imprime dados');
const test=fs.readFileSync('scripts/test-r299-tracking-auto-p9.cjs','utf8');
ok(test.includes("DFL_TRACKING_AUTO_PILOT_PHONE_E164='+5534999999999'"),'fixture de teste piloto configurada');
console.log(`R311_PILOTO_TRACKING_OK | ${count} verificacoes locais; ZERO rede.`);
