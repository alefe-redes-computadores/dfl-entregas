import fs from "node:fs";
const s=fs.readFileSync("app/api/integration/worker/route.ts","utf8");
const ok=(v,m)=>{if(!v)throw new Error("V13.2: "+m);console.log("OK",m)};
ok(s.includes("now - lastReports >= 15 * 60 * 1000"),"analytics em pulso protegido de 15m");
ok(s.includes("analytics: true"),"reconciliação analítica preservada");
ok(!s.includes("clock.weekday === 'Tue' && clock.hour === 4"),"gatilho semanal removido");
ok(s.includes("drainReverseIntegrationOutbox"),"relay reverso preservado");
console.log("DFL ENTREGAS ANALYTICS V13.2 — OK");
