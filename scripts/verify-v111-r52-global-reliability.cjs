#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
let checks = 0;
function check(condition, message) { assert.ok(condition, 'R52: ' + message); checks++; }
function source(file) {
  const data=fs.readFileSync(file,'utf8');
  const parsed=ts.createSourceFile(file,data,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  check(parsed.parseDiagnostics.length===0,'valid TS syntax: '+file);
  return data;
}
const notification=source('lib/native/notifications.ts');
const sync=source('lib/sync-diagnostics.ts');
const page=source('app/mais/diagnostico/page.tsx');
const pre=source('scripts/pre-apk.cjs');
for(const value of [
  "type ScheduleOwner = 'shift' | 'route-reminder'",
  'const scheduleTails = new Map<ScheduleOwner, Promise<void>>()',
  'const scheduleGenerations = new Map<ScheduleOwner, number>()',
  'if (scheduleGenerations.get(owner) !== generation) return',
  "return queueOwnerSchedule('shift', async () => {",
  "return queueOwnerSchedule('route-reminder', async () => {",
  "await cancelOwner('shift')", "await cancelOwner('route-reminder')",
]) check(notification.includes(value),'serialized owner notifications: '+value);
for(const value of [
  'export function sanitizeSyncDiagnostics(value: unknown)',
  'Number.isFinite(Date.parse(value))',
  'result.length >= MAX_ENTRIES',
  'return sanitizeSyncDiagnostics(JSON.parse(localStorage.getItem(STORAGE_KEY)',
  'entries = sanitizeSyncDiagnostics(entries);',
  "key !== '__proto__'",
]) check(sync.includes(value),'sync diagnostic sanitization: '+value);
for(const value of [
  "if (!Number.isFinite(parsed.getTime())) return 'Data indisponível'",
  'const recoveryClickLockRef = useRef(false)',
  'if (recoveryClickLockRef.current && !fromRetry) return',
  'if (auth.currentUser?.uid !== currentUser.uid) return',
  'recoveryClickLockRef.current = true;',
  'await loadRecovery(true);',
  'recoveryClickLockRef.current = false;',
  'const before = readSyncDiagnostics()[0]?.id',
  'last.id === before',
]) check(page.includes(value),'diagnostic page: '+value);
const suites=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);
check(suites.length >= 186, 'at least 186 PRE-APK suites');
check(new Set(suites).size===suites.length, 'no duplicate suites');
for(const path of suites) check(fs.existsSync(path),'required suite '+path);
for(const path of ['scripts/verify-v111-r52-global-reliability.cjs','scripts/test-v111-r52-reliability.cjs']) check(suites.includes(path),'new suite '+path);
check(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'owner-only rules untouched');
console.log(`R52 GLOBAL RELIABILITY: ${checks} checks OK; ${suites.length} suites`);
