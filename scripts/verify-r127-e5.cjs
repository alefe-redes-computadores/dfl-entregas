'use strict';
const fs=require('fs'),assert=require('node:assert/strict');
const root=process.cwd();
const guard=fs.readFileSync('lib/access/staffProjectionOwnership.ts','utf8');
const src=fs.readFileSync('lib/access/staffRefreshSnapshot.ts','utf8');
const commit=fs.readFileSync('lib/access/staffRefreshCommit.ts','utf8');
const runtime=fs.readFileSync('lib/access/staffRuntime.ts','utf8');
const rules=fs.readFileSync('security/firestore.v111-r26-candidate.rules','utf8');
const tests=[
 ['Guarda de rota explícita',guard.includes('r.motoboy_id===account.linkedMotoboyId')],
 ['Guarda de entrega explícita',guard.includes('d.route_id===routeId')],
 ['Rota filtrada antes de projetar',src.includes('if(!mayProjectRouteToAccount(account,data))continue;')],
 ['Entrega filtrada antes de projetar',src.includes('if(!mayProjectDeliveryToRoute(data,routeId))continue;')],
 ['Idempotência por ID',src.includes('const emittedDeliveryIds=new Set<string>();')],
 ['Sem consulta global para motoboy',src.includes("where('motoboy_id','==',linked)")],
 ['Limites mantidos',src.includes('routes:30,deliveries:40,stock:30,purchases:30,home:1')],
 ['Transação existente preservada',commit.includes('db.runTransaction(')&&commit.includes('staffRefreshProof(')],
 ['Conta suspensa na sincronização',commit.includes("status:'suspended'")],
 ['Portal bloqueia conta suspensa',runtime.includes("account.status !== 'active'")],
 ['Regras sem staff write',rules.includes('allow create, update, delete: if false;')],
];
for(const [name,ok] of tests){console.log(ok?'OK: '+name:'FALHOU: '+name);assert.ok(ok,name)}
console.log('R127 E5:',tests.length,'contratos OK; nenhum deploy ou ativação');
