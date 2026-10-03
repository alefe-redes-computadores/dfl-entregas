import fs from 'node:fs';
const s=fs.readFileSync('app/api/integration/worker/route.ts','utf8');
const ok=(v,m)=>{if(!v)throw new Error(`V13 analytics: ${m}`);console.log('OK',m)};
ok(s.includes("now - lastReports >= 15 * 60 * 1000"),'reports protected 15m pulse');
ok(s.includes("analytics: true"),'analytics reconciliation enabled');
ok(!s.includes("clock.weekday === 'Tue' && clock.hour === 4"),'weekly-only reports removed');
console.log('DFL RELATÓRIOS V13 — WORKER CONTRATO OK');
