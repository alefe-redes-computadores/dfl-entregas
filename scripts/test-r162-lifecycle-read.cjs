const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/operation/lifecycle-read-model.ts','utf8');
const home=fs.readFileSync('lib/operation/home-exceptions.ts','utf8');
for(const [file,s,kind] of [['lib/operation/lifecycle-read-model.ts',source,ts.ScriptKind.TS],['lib/operation/home-exceptions.ts',home,ts.ScriptKind.TS]]){
 const parsed=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,kind);
 assert.equal(parsed.parseDiagnostics.length,0,`${file}: sintaxe`);
}
assert.match(source,/delivery\.operational_dismissed_at/);
assert.match(source,/delivery\.completed === true/);
assert.match(source,/delivery\.delivery_attempts/);
assert.match(source,/isFutureScheduledDelivery\(delivery, now\)/);
assert.match(source,/isCancelledSiteDelivery\(delivery\)/);
assert.match(home,/R162_LIFECYCLE_GUARD/);
assert.match(home,/item\.completed \|\| item\.operational_dismissed_at/);
assert.match(home,/item\.source_system === 'dfl_site' && isFutureScheduledForHome\(item\)/);
assert.doesNotMatch(source,/deleteDoc|updateDoc|setDoc|runTransaction|collection\(/);
console.log('R162: 9 contratos de ciclo de vida e nao-escrita OK');

assert.doesNotMatch(home,/import \{ isFutureScheduledDelivery \} from/);
assert.match(home,/Number\(item\.schedule_window_minutes\) \|\| 30/);
console.log('R162 R2: classificador autocontido, sem novas dependencias no R88');
