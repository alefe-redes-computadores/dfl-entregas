#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict'),vm=require('node:vm');let count=0;
const eq=(actual,expected,name)=>{assert.equal(actual,expected,'R65 '+name);count++};
function load(file,mocks={}){
 const source=fs.readFileSync(file,'utf8');const r=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}});
 assert.equal(r.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0);
 const context={exports:{},require:(name)=>{if(name in mocks)return mocks[name];throw Error('unexpected import '+name)},Date,Intl,Number,Map,Set,Array,String,console,Math};
 vm.runInNewContext(r.outputText,context,{filename:file,timeout:5000});return context.exports;
}
const times=load('lib/operational-time.ts',{'@/lib/reports/time':{firstValidTimestamp:(...xs)=>{for(const x of xs){const d=new Date(x);if(Number.isFinite(d.getTime()))return d;}return null;}}});
const monday='2026-10-19',tuesday='2026-10-20';
eq(times.isPausedOn(undefined,monday),false,'undefined pauses');
eq(times.isPausedOn([null],monday),false,'malformed null pause');
eq(times.isPausedOn([{start_date:monday}],monday),true,'single-day legacy pause');
eq(times.isPausedOn([{start_date:monday}],tuesday),false,'single-day pause expires');
eq(times.isPausedOn([{start_date:monday,end_date:tuesday}],tuesday),true,'range inclusive');
eq(times.isPausedOn([{start_date:tuesday,end_date:monday}],monday),false,'reverse range denied');
eq(times.isPausedOn([{start_date:'',end_date:''}],monday),false,'empty dates');
eq(times.isPausedOn([{start_date:monday,end_date:tuesday}],''),false,'invalid day key');
const schedule={1:{active:true,shifts:[{start:'18:00',end:'23:30'}]},2:{active:false,shifts:[]}};
const open={date:tuesday,active:true,shifts:[{start:'18:00',end:'21:00'}]};
eq(times.operationalDaySchedule(monday,schedule,[],{})?.active,true,'normal Monday');
eq(times.operationalDaySchedule(tuesday,schedule,[],{})?.active,false,'normal Tuesday closed');
eq(times.operationalDaySchedule(tuesday,schedule,[],{[tuesday]:open})?.active,true,'holiday exception opens closed Tuesday');
eq(times.operationalDaySchedule(monday,schedule,[],{[monday]:{active:false,shifts:[]}})?.active,false,'holiday exception closes open Monday');
eq(times.operationalDaySchedule(monday,schedule,[{start_date:monday}],{})===undefined,true,'legacy pause blocks day');
const worker=load('lib/integration/worker-health.ts');
const rec=(read,ids=[],extra={})=>({ok:true,value:{ok:true,statusRecoveryReplayEnabled:true,statusRecoveryReplayRead:read,statusRecoveryReplayEventIds:ids,...extra}});
const relay={ok:true,value:{ok:true,failed:0,unsettled:0}};
for(const read of [-1,NaN,Infinity,'0',null,undefined,0.5,40,41])eq(worker.recoveryCheckpointEligible(rec(read,[]),null,40),false,'bad recovery read '+String(read));
for(const limit of [0,-1,0.5,Infinity,NaN,'40',null])eq(worker.recoveryCheckpointEligible(rec(0),null,limit),false,'bad batch limit '+String(limit));
for(const ids of [null,'a',[null],[1],[''],['  '],[{},'a']])eq(worker.recoveryCheckpointEligible(rec(1,ids),relay,40),false,'bad ids '+String(ids));
eq(worker.recoveryCheckpointEligible(rec(0),null,40),true,'empty clean batch can checkpoint');
eq(worker.recoveryCheckpointEligible(rec(1,['abc']),relay,40),true,'relayed pending batch checkpoints');
eq(worker.recoveryCheckpointEligible(rec(1,['abc']),null,40),false,'missing relay blocks');
eq(worker.recoveryCheckpointEligible(rec(0,['abc']),relay,40),false,'ids exceed reads blocks');
eq(worker.recoveryCheckpointEligible(rec(2,['abc']),relay,40),true,'some reads need relay');
const outcome=load('lib/integration/drain-outcome.ts');
for(const value of [NaN,Infinity,'0',false,{},-1,1,0.1]){
 eq(outcome.reverseDrainOutcome({ok:true,failed:value},null).ok,false,'invalid relay failed '+String(value));
 eq(outcome.reverseDrainOutcome(null,{ok:true,unsettled:value}).ok,false,'invalid relay unsettled '+String(value));
}
eq(outcome.reverseDrainOutcome(null,null).ok,true,'no operation is not failure');
eq(outcome.reverseDrainOutcome({ok:true,failed:0,unsettled:0},null).httpStatus,200,'real success');
const readiness=load('lib/operational-readiness.ts',{
 '@/lib/route-intelligence':{deliveryPoint:(d,c)=>d.hasGps?{lat:1,lng:1}:undefined},
 '@/lib/integration/site-order':{isCancelledSiteDelivery:d=>d.cancelled===true},
 '@/lib/delivery-mode':{isDeliveryFulfillment:d=>d.kind!=='pickup'},
 '@/lib/scheduled-delivery':{isFutureScheduledDelivery:d=>d.future===true},
});
const items=[{id:'active',customer_id:'a',route_id:'r',completed:false,address_string:''},{id:'cancel',customer_id:'a',completed:false,cancelled:true},{id:'pick',kind:'pickup',completed:false},{id:'future',completed:false,future:true},{id:'done',completed:true},{id:'address',completed:false,address_string:'Rua Um',route_id:'r'},{id:'gps',completed:false,hasGps:true}];
const ready=readiness.buildOperationalReadiness({deliveries:items,routes:[{id:'r',status:'aberta'}],customers:[]});
eq(ready.missingAddress.map(d=>d.id).join(','),'active','only actionable addresses missing');
eq(ready.unconfirmedLocation.map(d=>d.id).join(','),'address','only active route address-only');
for(let i=0;i<2000;i++){
 const a=new Date(Date.UTC(2026,9,19+(i%14),18)); const k=times.dateKey(a);
 const p=[{start_date:k,end_date:k}];eq(times.isPausedOn(p,k),true,'valid same-day pause '+i);
}
console.log(`R65 OPENING RESILIENCE: ${count} behavioral checks OK`);
