#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let checks = 0;
const test = (condition, name) => { assert.ok(condition, name); checks += 1; };
function js(file) { return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText; }

// Storage may contain truncated entries from old versions or interrupted WebView writes.
const storage = new Map();
const diagModule = { exports: {} };
vm.runInNewContext(js('lib/sync-diagnostics.ts'), {
  module: diagModule, exports: diagModule.exports,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key,value), removeItem: key => storage.delete(key) },
  window: { dispatchEvent: () => {} }, CustomEvent: class {}, Date, Math, JSON,
});
const diag = diagModule.exports;
const read = () => diag.readSyncDiagnostics();
storage.set('dfl-sync-diagnostics-v1','{"broken"');
test(read().length === 0, 'Malformed storage is ignored');
const valid = { id:'one', startedAt:'2026-10-21T09:00:00.000Z', finishedAt:'2026-10-21T09:00:01.000Z', durationMs:1000, status:'success', totalDocuments:9, collections:{deliveries:5} };
storage.set('dfl-sync-diagnostics-v1',JSON.stringify([null,false,{}, {...valid, id:'bad-date', finishedAt:'oops'}, valid, {...valid, id:'one', collections:null}, { ...valid, id:'two', collections:{deliveries:-99, routes:7, __proto__:null}}, { ...valid, id:'three', message:42, totalDocuments:Infinity }]));
const safe = read();
test(safe.length === 3, 'Invalid/duplicate rows are dropped');
test(safe[0].collections.deliveries === 5, 'Valid collection counts preserved');
test(safe[1].collections.routes === 7 && !('deliveries' in safe[1].collections),'Invalid count ignored');
test(safe[2].message === undefined && safe[2].totalDocuments === 0,'Invalid optional fields normalized');
test(diag.syncDiagnosticText([{...valid, collections:null}]).includes('diagnóstico'), 'Text export survives unexpected records');
test(diag.syncDiagnosticText([{...valid, finishedAt:'invalid'}]).includes('nenhum diagnóstico'), 'Export rejects invalid dates');
const many = Array.from({length:90},(_,index)=>({...valid,id:'id'+index}));
test(diag.sanitizeSyncDiagnostics(many).length === 30, 'Storage bound to 30 entries');

// Simulate asynchronous Android plugin: older notification scheduling finishes
// *after* a new disabled configuration has arrived.
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-15T12:00:00Z'])); }
  static now() { return new Date('2026-10-15T12:00:00Z').getTime(); }
}
let pending = new Map();
let scheduleCalls = 0;
let firstGate = null;
let firstStarted = null;
let firstStartedResolve = null;
function armDelay() {
  firstGate = {};
  firstGate.promise = new Promise(resolve => { firstGate.resolve=resolve; });
  firstStarted = new Promise(resolve => { firstStartedResolve=resolve; });
}
const plugins = {
  createChannel: async()=>{},
  checkPermissions: async()=>({display:'granted'}),
  getPending: async()=>({notifications:[...pending.values()]}),
  cancel: async ({notifications})=>{ for(const n of notifications) pending.delete(n.id); },
  schedule: async({notifications})=>{
    scheduleCalls++;
    if (firstGate && scheduleCalls===1) {
      firstStartedResolve();
      await firstGate.promise;
    }
    for(const n of notifications) pending.set(n.id,n);
  },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = {exports:{}};
  modules.set(file,module);
  vm.runInNewContext(js(file), {
    module, exports:module.exports, Date:Clock, Intl,
    console:{...console,error:()=>{}},
    require(id) {
      if (id==='@capacitor/core') return {Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'}};
      if (id==='@capacitor/app') return {App:{getState:async()=>({isActive:false})}};
      if (id==='@capacitor/local-notifications') return {LocalNotifications:plugins};
      if (id.startsWith('@/')) return load(id.slice(2)+'.ts');
      throw Error('Unexpected mock module: '+id);
    },
  },{filename:file});
  return module.exports;
}
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const notifications = load('lib/native/notifications.ts');
  const preference = Object.fromEntries(Object.keys(notifications.DEFAULT_NOTIFICATION_PREFERENCES).map(k=>[k,false]));
  Object.assign(preference,{enabled:true,ifoodAdsBeforeOpen:true,ifoodAdsAfterClose:true,routeOpenReminder:true});
  const settings = {notificationPreferences:preference,schedule:{4:{active:true,shifts:[{start:'18:00',end:'01:00'}]}}};
  armDelay();
  const original=notifications.syncShiftNotifications(settings);
  await Promise.race([firstStarted, sleep(1000).then(()=>{throw Error('shift schedule not started');})]);
  const updated=notifications.syncShiftNotifications({...settings,notificationPreferences:{...preference,enabled:false}});
  firstGate.resolve();
  await Promise.all([original,updated]);
  test(pending.size===0, 'Disabled shift update wins over an older in-flight schedule');
  test(scheduleCalls===1, 'The old schedule finishes once and new disabled update cancels');

  pending=new Map();scheduleCalls=0;armDelay();
  const routes=[{id:'r1',name:'Rota A',status:'aberta',started_at:'2026-10-15T20:00:00.000Z'}];
  const routeFirst=notifications.syncOpenRouteReminderNotifications(routes,settings);
  await Promise.race([firstStarted,sleep(1000).then(()=>{throw Error('route schedule not started');})]);
  const routeSecond=notifications.syncOpenRouteReminderNotifications([],{...settings,routeReminderEnabled:false});
  firstGate.resolve();
  await Promise.all([routeFirst,routeSecond]);
  test(pending.size===0,'Disabled route reminder wins over stale schedule');
  test(scheduleCalls===1,'Route reminder scheduled once before latest cancellation');

  scheduleCalls=0;firstGate=null;pending=new Map();
  const stale=notifications.syncShiftNotifications(settings);
  const fresh=notifications.syncShiftNotifications({...settings,notificationPreferences:{...preference,enabled:false}});
  await Promise.all([stale,fresh]);
  test(scheduleCalls===0,'Queue drops superseded work before schedule starts');
  test(pending.size===0,'No stale scheduled shift survives');
  console.log(`R52 behavior: ${checks} checks OK`);
})().catch(error=>{console.error(error);process.exitCode=1;});
