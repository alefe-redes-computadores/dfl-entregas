#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
let count = 0;
const ok = (pass,label) => { assert.ok(pass, 'R92: '+label); count++; console.log('OK R92:',label); };
const source = fs.readFileSync('lib/operation/snapshot-sync-safety.ts','utf8');
const js = ts.transpileModule(source, {fileName:'snapshot-sync-safety.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
ok(!(js.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'helper TS transpilável');
const mod = new Module(path.resolve('lib/operation/snapshot-sync-safety.ts'),module); mod.filename=path.resolve('lib/operation/snapshot-sync-safety.ts');mod.paths=module.paths;mod._compile(js.outputText,mod.filename);
const {captureOperationalBaseline,preserveInFlightLocalEdits,trustedIncrementalCheckpoint,operationalDeliverySignature:delSig,operationalRouteSignature:routeSig,syncOwnerStillCurrent}=mod.exports;
const remote = (id,value,extra={}) => ({id, value, updated_at: String(value), ...extra});
const initial = [remote('a',1,{completed:false}),remote('b',1,{completed:false})];
const before = captureOperationalBaseline(initial,delSig);
const fetched = [remote('a',2,{completed:true}),remote('b',2,{completed:true}),remote('c',2,{completed:true})];
const still = preserveInFlightLocalEdits(fetched,initial,before,delSig);
ok(still[0]===fetched[0] && still[1]===fetched[1],'nuvem permanece soberana sem edição concorrente');
const changed = [remote('a',3,{completed:true}),initial[1]];
const safe = preserveInFlightLocalEdits(fetched,changed,before,delSig);
ok(safe[0]===changed[0] && safe[1]===fetched[1] && safe[2]===fetched[2],'protege só a edição local no meio do download');
const created = remote('c',4,{completed:false});
const safeNew = preserveInFlightLocalEdits(fetched,[...initial,created],before,delSig);
ok(safeNew[2]===created,'criação otimista concorrente não perde conteúdo');
const deleted = preserveInFlightLocalEdits(fetched,[initial[1]],before,delSig);
ok(deleted.map(v=>v.id).join(',')==='b,c','remoção concorrente não ressuscita registro');
const visual = {...initial[0],is_expanded:true};
const unchanged = preserveInFlightLocalEdits(fetched,[visual,initial[1]],before,delSig);
ok(unchanged[0]===fetched[0],'expandir card não rouba autoridade cloud');
const routeBefore=[{id:'r',name:'Rota 1',status:'aberta'}];
const routeBaseline=captureOperationalBaseline(routeBefore,routeSig);
const routeEdited={id:'r',name:'Rota 1',status:'fechada'};
ok(preserveInFlightLocalEdits([{id:'r',name:'Rota 1',status:'aberta'}],[routeEdited],routeBaseline,routeSig)[0]===routeEdited,'fechamento concorrente de rota protegido');
const start=Date.parse('2026-10-24T12:00:00Z');
const stamp=(s)=>({time:s});
const cp=trustedIncrementalCheckpoint([stamp('2026-10-24T11:30:00Z'),stamp('2027-10-24T11:30:00Z'),stamp('nada')],v=>v.time,start);
ok(cp===Date.parse('2026-10-24T11:30:00Z'),'timestamp local futuro ignorado');
ok(trustedIncrementalCheckpoint([stamp('2027-10-24T11:30:00Z')],v=>v.time,start)===0,'só futuro força bootstrap seguro');
ok(trustedIncrementalCheckpoint([],v=>v.time,start)===0,'lista vazia permite bootstrap');
ok(trustedIncrementalCheckpoint([stamp('invalid')],v=>v.time,start)===0,'timestamp inválido não contamina checkpoint');
ok(trustedIncrementalCheckpoint([stamp('2026-10-24T12:00:00Z')],v=>v.time,start)===start,'timestamp exatamente atual aceito');
ok(trustedIncrementalCheckpoint([stamp('2026-10-24T11:00:00Z')],v=>v.time,NaN)===0,'relógio inválido mantém fallback');
ok(syncOwnerStillCurrent('owner','owner'),'mesma conta pode concluir');
ok(!syncOwnerStillCurrent('owner','other'),'mudança de conta bloqueia merge');
ok(!syncOwnerStillCurrent('owner',undefined),'logout durante sync bloqueia merge');
ok(!syncOwnerStillCurrent(undefined,undefined),'sem dono não aplica dados');
const store=fs.readFileSync('store/useAppStore.ts','utf8');
for(const [term,label] of [
 ['trustedIncrementalCheckpoint(', 'checkpoint seguro ligado ao fetch'],
 ['const syncOwnerUid = get().user?.uid;', 'identidade antes das consultas'],
 ['syncOwnerStillCurrent(syncOwnerUid, get().user?.uid)', 'verificação de sessão após as consultas'],
 ['captureOperationalBaseline(get().deliveries, operationalDeliverySignature)', 'baseline de pedidos antes do download'],
 ['captureOperationalBaseline(get().routes, operationalRouteSignature)', 'baseline de rotas antes do download'],
 ['preserveInFlightLocalEdits(mergeCloudFirstById(fbRoutes', 'rota cloud-first + edição concorrente'],
 ['preserveInFlightLocalEdits(mergeDeliveriesPreservingExpansion(fbDeliveries', 'entrega cloud-first + edição concorrente'],
 ['const FIRESTORE_INCREMENTAL_OVERLAP_MS = 5 * 60 * 1000;', 'janela de sobreposição preservada'],
 ['let initDataInFlight = false;', 'lock de initData preservado'],
 ['mergeCloudFirstById(fbCustomers', 'clientes seguem sem mudança'],
 ['mergeById(fbStockMovements', 'estoque mantém contrato'],
 ['recordSyncDiagnostic({', 'diagnóstico permanece disponível'],
 ]) ok(store.includes(term),label);
const tsPaths=['store/useAppStore.ts','lib/operation/snapshot-sync-safety.ts'];
for(const f of tsPaths){const tree=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);ok(tree.parseDiagnostics.length===0,'sintaxe '+f)}
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
ok(pre.includes("'scripts/test-v112-r92-snapshot-integrity.cjs'"),'testes R92 registrados no pré-APK');
for(const f of ['scripts/test-v112-r91-sync-resilience.cjs','scripts/test-v112-r90-home-card-performance.cjs','scripts/test-v112-r89-performance.cjs','scripts/test-v112-r85-message-policy.cjs'])ok(pre.includes(f),'versão anterior preservada '+f);
ok(!source.includes('firebase/firestore')&&!source.includes('getDocs(')&&!source.includes('setDoc('),'helper não executa rede');
console.log('V112 R92 SNAPSHOT INTEGRITY: '+count+' contratos aprovados');
