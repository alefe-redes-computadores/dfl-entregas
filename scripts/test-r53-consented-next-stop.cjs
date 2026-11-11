'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),cp=require('node:child_process');
const input=fs.readFileSync('scripts/test-r302-next-stop-dedupe.cjs','utf8');
let data=input;
function swap(before,after,label){assert.equal(data.split(before).length-1,1,`R53 ${label} assinatura unica`);data=data.replace(before,after);}
swap("DFL_MANUAL_NEXT_STOP_SCOPE:'canary'","DFL_MANUAL_NEXT_STOP_SCOPE:'consented_customers'",'next scope');
swap("DFL_MANUAL_MESSAGING_SCOPE:'canary'","DFL_MANUAL_MESSAGING_SCOPE:'consented_customers'",'manual scope');
swap("DFL_MESSAGING_PILOT_PHONE_E164:phone","DFL_MESSAGING_PILOT_PHONE_E164:'5534988888888',DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED:'true'",'general rollout');
swap("equal(payload.event_type,'delivery.next_stop','evento de próxima parada');","equal(payload.event_type,'delivery.next_stop','evento de próxima parada');\n  equal(payload.customer_phone,phone,'numero real do pedido, nao piloto');",'phone');
const srv=fs.readFileSync('lib/integration/server/manualNextStop.ts','utf8');
assert.ok(srv.includes("DFL_MANUAL_NEXT_STOP_SCOPE === 'consented_customers'")&&srv.includes("DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED === 'true'"),'duplo gate geral');
assert.ok(srv.includes('d.notify_whatsapp !== true || d.manual_messaging_opt_in_v1 !== true'),'consentimento duplo');
assert.ok(srv.includes('d.owner_order_context || d.exclude_from_reports === true || d.developer_test === true'),'bloqueio DEV na modalidade geral');
assert.ok(srv.includes('recipientLedgerKey')&&srv.includes("collection('manual_next_stop_transitions_v2')"),'dedupe persistente');
const f=path.join('scripts',`.r53-transient-${process.pid}.cjs`);
try{
 fs.writeFileSync(f,data,{flag:'wx'});
 const r=cp.spawnSync(process.execPath,[f],{cwd:process.cwd(),encoding:'utf8',timeout:180000});
 if(r.stdout)process.stdout.write(r.stdout);
 if(r.stderr)process.stderr.write(r.stderr);
 assert.equal(r.status,0,`R53 entrega fisica geral: ${r.error||'exit='+r.status}`);
}finally{try{fs.unlinkSync(f);}catch(e){}}
console.log('R53 ENTREGAS: replay hermetico com numero real, dedupe e guards gerais aprovados');
